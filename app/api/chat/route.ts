import { NextResponse } from "next/server";
import { retrieve } from "@/lib/retrieve";
import { parseIntent, type ParsedIntent } from "@/lib/intent";
import {
  actionToText,
  dispatchTool,
  OPENAI_TOOL_DEFS,
  type ChatAction,
} from "@/lib/tools";
import { CHAT_FALLBACK, CHAT_PROMPT_VERSION, CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

type ChatOutcome =
  | "answered"
  | "refusal"
  | "booking_created"
  | "booking_failed"
  | "booking_needs_details"
  | "availability"
  | "availability_failed";

// One structured log line per turn (see AI_ENGINEER.md). JSON so it
// can be grepped and counted; deliberately no personal data — no
// names, phones or emails, only the intent kind, the tool name, the
// retrieved chunk ids and the outcome.
function logTurn(fields: {
  mode: string;
  intent: string;
  tool: string | null;
  chunks: string[];
  outcome: ChatOutcome;
  latencyMs: number;
}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      route: "/api/chat",
      promptVersion: CHAT_PROMPT_VERSION,
      ...fields,
    })
  );
}

// Free mode, booking intent: the parser already extracted what it
// could. Anything missing is asked for — never guessed.
async function handleBookingFree(intent: Extract<ParsedIntent, { kind: "booking" }>): Promise<{
  answer: string;
  action: ChatAction;
  outcome: ChatOutcome;
}> {
  const missing: string[] = [];
  if (!intent.service) missing.push("service");
  if (!intent.name) missing.push("name");
  if (!intent.contact) missing.push("contact");
  if (!intent.date) missing.push("day");
  if (!intent.time) missing.push("time");
  if (missing.length > 0) {
    const action: ChatAction = {
      type: "booking_needs_details",
      service: intent.service,
      missing,
    };
    return { answer: actionToText(action), action, outcome: "booking_needs_details" };
  }
  return handleBookingTool({
    service: intent.service!,
    name: intent.name!,
    contact: intent.contact!,
    date: intent.date,
    time: intent.time,
    stylist: intent.stylist,
  });
}

async function handleBookingTool(args: {
  service: string;
  name: string;
  contact: string;
  date?: string;
  time?: string;
  stylist?: string;
}): Promise<{ answer: string; action: ChatAction; outcome: ChatOutcome }> {
  const { action } = await dispatchTool("createBooking", args);
  return {
    answer: actionToText(action),
    action,
    outcome:
      action.type === "booking_created" ? "booking_created" : "booking_failed",
  };
}

// OpenAI mode: real function calling. The model sees the versioned
// system prompt, the retrieved chunks as its only context, and the
// three tools — and decides what to call. Tool results are the
// server-side actions, fed back to the model verbatim, so the model
// can never invent a price, slot or booking. If the model finishes
// a tool intent without calling a tool, the deterministic tool call
// runs as a safety net so the answer is still correct.
async function answerWithTools(
  question: string,
  context: string,
  intent: ParsedIntent
): Promise<{ answer: string; action?: ChatAction } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const messages: Record<string, unknown>[] = [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Business context:\n${context}\n\nQuestion: ${question}`,
      },
    ];
    let action: ChatAction | undefined;
    let lastText = "";
    for (let round = 0; round < 3; round++) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          tools: OPENAI_TOOL_DEFS,
          tool_choice: "auto",
          temperature: 0,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return null;
      messages.push(msg);
      const calls: { id: string; function: { name: string; arguments: string } }[] =
        msg.tool_calls ?? [];
      if (calls.length === 0) {
        lastText = typeof msg.content === "string" ? msg.content : "";
        break;
      }
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        const { action: toolAction, summary } = await dispatchTool(
          call.function.name,
          args
        );
        action = toolAction;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: summary,
        });
      }
    }
    // Safety net: a tool intent the model never acted on.
    if (!action && intent.kind === "booking") {
      const handled = await handleBookingFree(
        intent as Extract<ParsedIntent, { kind: "booking" }>
      );
      return { answer: handled.answer, action: handled.action };
    }
    if (!action && intent.kind === "availability" && intent.date) {
      const { action: toolAction } = await dispatchTool("getAvailability", {
        date: intent.date,
        stylist: intent.stylist,
      });
      return { answer: actionToText(toolAction), action: toolAction };
    }
    return { answer: lastText, action };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const started = Date.now();
  const useOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const mode = useOpenAI ? "openai" : "free";
  // Hardening (see SECURITY.md): size cap + per-IP rate limit
  // (30/min) + a 1,000-character cap on the question. The widget
  // reads `answer` whatever the status, so rate/validation failures
  // answer in that field and the widget shows them instead of
  // breaking.
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { answer: "That message is too long — please keep it shorter." },
      { status: 413 }
    );
  }
  const ip = clientIp(req);
  const limit = rateLimit(`chat:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { answer: "Too many messages — please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const { message } =
    typeof body === "object" && body !== null
      ? (body as { message?: unknown })
      : { message: "" };
  if (!message || typeof message !== "string") {
    return NextResponse.json({ answer: "Please ask a question about the studio." });
  }
  if (message.length > 1000) {
    return NextResponse.json({
      answer: "Please keep your question under 1,000 characters.",
    });
  }

  const intent = parseIntent(message);
  const chunks = retrieve(message);
  const chunkIds = chunks.map((c) => c.id);

  // Tool intents run before retrieval: a booking or availability
  // question is answered from the tools (the diary and the lead
  // save), not from prose chunks.
  if (intent.kind === "booking") {
    if (useOpenAI) {
      const context = chunks.map((c) => `${c.title}: ${c.text}`).join("\n");
      const llm = await answerWithTools(message, context, intent);
      if (llm) {
        const outcome: ChatOutcome =
          llm.action?.type === "booking_created"
            ? "booking_created"
            : llm.action?.type === "booking_needs_details"
              ? "booking_needs_details"
              : "booking_failed";
        logTurn({ mode, intent: "booking", tool: "createBooking", chunks: chunkIds, outcome, latencyMs: Date.now() - started });
        return NextResponse.json({
          answer: llm.answer,
          sources: chunks.map((c) => c.title),
          grounded: true,
          mode,
          promptVersion: CHAT_PROMPT_VERSION,
          action: llm.action ?? undefined,
        });
      }
      // LLM unavailable (bad key, network): fall through to free mode.
    }
    const handled = await handleBookingFree(intent);
    logTurn({ mode: "free", intent: "booking", tool: "createBooking", chunks: chunkIds, outcome: handled.outcome, latencyMs: Date.now() - started });
    return NextResponse.json({
      answer: handled.answer,
      sources: chunks.map((c) => c.title),
      grounded: true,
      mode: "free",
      promptVersion: CHAT_PROMPT_VERSION,
      action: handled.action,
    });
  }

  if (intent.kind === "availability") {
    if (intent.date) {
      if (useOpenAI) {
        const context = chunks.map((c) => `${c.title}: ${c.text}`).join("\n");
        const llm = await answerWithTools(message, context, intent);
        if (llm) {
          const outcome: ChatOutcome =
            llm.action?.type === "availability" ? "availability" : "availability_failed";
          logTurn({ mode, intent: "availability", tool: "getAvailability", chunks: chunkIds, outcome, latencyMs: Date.now() - started });
          return NextResponse.json({
            answer: llm.answer,
            sources: chunks.map((c) => c.title),
            grounded: true,
            mode,
            promptVersion: CHAT_PROMPT_VERSION,
            action: llm.action ?? undefined,
          });
        }
      }
      const { action } = await dispatchTool("getAvailability", {
        date: intent.date,
        stylist: intent.stylist,
      });
      const outcome: ChatOutcome =
        action.type === "availability" ? "availability" : "availability_failed";
      logTurn({ mode: "free", intent: "availability", tool: "getAvailability", chunks: chunkIds, outcome, latencyMs: Date.now() - started });
      return NextResponse.json({
        answer: actionToText(action),
        sources: chunks.map((c) => c.title),
        grounded: true,
        mode: "free",
        promptVersion: CHAT_PROMPT_VERSION,
        action,
      });
    }
    // A day is needed before availability can be checked.
    logTurn({ mode, intent: "availability", tool: null, chunks: chunkIds, outcome: "availability_failed", latencyMs: Date.now() - started });
    return NextResponse.json({
      answer:
        "Which day? The diary covers November 2026 — for example, ask 'Is Saturday 14 November free?'",
      sources: chunks.map((c) => c.title),
      grounded: true,
      mode,
      promptVersion: CHAT_PROMPT_VERSION,
    });
  }

  // Plain Q&A: the grounded path is unchanged — no retrieved chunk,
  // no answer (the refusal), in both modes.
  if (chunks.length === 0) {
    logTurn({ mode, intent: "none", tool: null, chunks: [], outcome: "refusal", latencyMs: Date.now() - started });
    return NextResponse.json({
      answer: CHAT_FALLBACK,
      sources: [],
      mode,
      promptVersion: CHAT_PROMPT_VERSION,
    });
  }

  const context = chunks.map((c) => `${c.title}: ${c.text}`).join("\n");
  if (useOpenAI) {
    const llm = await answerWithTools(message, context, intent);
    if (llm) {
      logTurn({ mode, intent: "none", tool: null, chunks: chunkIds, outcome: "answered", latencyMs: Date.now() - started });
      return NextResponse.json({
        answer: llm.answer,
        sources: chunks.map((c) => c.title),
        grounded: true,
        mode,
        promptVersion: CHAT_PROMPT_VERSION,
        action: llm.action ?? undefined,
      });
    }
    // LLM unavailable: fall through to the retrieved text below.
  }
  logTurn({ mode: "free", intent: "none", tool: null, chunks: chunkIds, outcome: "answered", latencyMs: Date.now() - started });
  return NextResponse.json({
    answer: chunks.map((c) => c.text).join(" "),
    sources: chunks.map((c) => c.title),
    grounded: true,
    mode: "free",
    promptVersion: CHAT_PROMPT_VERSION,
  });
}

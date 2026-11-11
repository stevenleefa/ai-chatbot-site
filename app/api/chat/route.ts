import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import { retrieve } from "@/lib/retrieve";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

const FALLBACK =
  `I don't have that information in ${business.name}'s details, so I won't guess. ` +
  `You can call ${business.phone} or use the booking form on this page and the team will confirm it.`;

async function answerWithLLM(question: string, context: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You answer only from the business context below. If the answer is not in the context, say you do not know and suggest calling the business. Never invent prices, hours, services or policies.",
          },
          { role: "user", content: `Business context:\n${context}\n\nQuestion: ${question}` },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Hardening (see SECURITY.md): size cap + per-IP rate limit
  // (30/min) + a 1,000-character cap on the question. The widget
  // reads `answer` whatever the status, so rate/validation failures
  // answer in that field and the widget shows them instead of
  // breaking. The grounding itself is unchanged: the answer still
  // comes only from retrieved business chunks (or, when the LLM key
  // is set, from the LLM with those chunks as its only context).
  // The cap covers chunked bodies too (readCappedJson reads the raw
  // body and measures its bytes — a chunked request carries no
  // content-length header, so a header-only check would miss it).
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

  const chunks = retrieve(message);
  if (chunks.length === 0) {
    return NextResponse.json({ answer: FALLBACK, sources: [] });
  }

  const context = chunks.map((c) => `${c.title}: ${c.text}`).join("\n");
  const llmAnswer = await answerWithLLM(message, context);
  return NextResponse.json({
    answer: llmAnswer ?? chunks.map((c) => c.text).join(" "),
    sources: chunks.map((c) => c.title),
    grounded: true,
  });
}

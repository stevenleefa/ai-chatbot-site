import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import { retrieve } from "@/lib/retrieve";

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
  const { message } = await req.json().catch(() => ({ message: "" }));
  if (!message || typeof message !== "string") {
    return NextResponse.json({ answer: "Please ask a question about the studio." });
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

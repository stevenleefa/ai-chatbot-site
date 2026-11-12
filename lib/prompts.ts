// Prompt management for the Lumen assistant.
//
// Prompts are versioned code, not strings hidden in a route handler.
// When the wording changes, bump CHAT_PROMPT_VERSION and note what
// changed in AI_ENGINEER.md — the version is returned with every
// /api/chat response and logged per turn, so an eval failure can
// always be traced to the exact prompt that produced it.
//
// The rules below are the whole grounding contract, in both modes:
// free mode (deterministic tools + retrieval) and OpenAI mode
// (function calling). Nothing in the system prompt may promise a
// price, hour or service that is not in the business data — the
// model only ever sees retrieved chunks and tool results.

export const CHAT_PROMPT_VERSION = "lumen-chat-v1";

export const CHAT_SYSTEM_PROMPT = [
  "You are the assistant for Lumen Hair Studio, a hair salon at 12 Maple Street.",
  "Answer ONLY from the business context and tool results given to you in this conversation.",
  "Never invent prices, hours, services, policies or availability — if it is not in the context or a tool result, say you do not know and suggest calling (555) 014-8890 or using the booking form.",
  "You may call tools to look up services, check availability, or create a booking.",
  "To create a booking you MUST have the service, the visitor's name, a phone number or email, the day and the time — if anything is missing, ask for it instead of guessing.",
  "Bookings are requests: the studio confirms them, so never claim a booking is confirmed — say it has been requested and the studio will confirm shortly.",
  "Keep answers short, friendly, and in plain language.",
].join(" ");

// The grounded refusal — used whenever no retrieved chunk matches
// and no tool applies. The visitor is never left guessing, and the
// business's phone and booking form are always offered instead.
export const CHAT_FALLBACK =
  "I don't have that information in Lumen Hair Studio's details, so I won't guess. " +
  "You can call (555) 014-8890 or use the booking form on this page and the team will confirm it.";

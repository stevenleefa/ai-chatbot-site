// Prompt management tests (lib/prompts.ts). Prompts are versioned
// code: the version string is returned with every chat response, so
// these tests pin the contract — a prompt edit must bump the version
// and keep the grounding rules.
import {
  CHAT_FALLBACK,
  CHAT_PROMPT_VERSION,
  CHAT_SYSTEM_PROMPT,
} from "@/lib/prompts";

describe("chat prompts", () => {
  it("has a versioned prompt id", () => {
    expect(CHAT_PROMPT_VERSION).toMatch(/^lumen-chat-v\d+$/);
  });

  it("system prompt enforces grounded-only answers", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("ONLY from the business context");
    expect(CHAT_SYSTEM_PROMPT).toContain("Never invent prices");
    expect(CHAT_SYSTEM_PROMPT).toContain("do not know");
    expect(CHAT_SYSTEM_PROMPT).toContain("call tools");
    expect(CHAT_SYSTEM_PROMPT).toContain("(555) 014-8890");
  });

  it("system prompt requires full booking details before booking", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("MUST have the service");
    expect(CHAT_SYSTEM_PROMPT).toContain("never claim a booking is confirmed");
  });

  it("fallback refuses to guess and offers phone and booking form", () => {
    expect(CHAT_FALLBACK).toContain("don't have that information");
    expect(CHAT_FALLBACK).toContain("(555) 014-8890");
    expect(CHAT_FALLBACK).toContain("booking form");
  });
});

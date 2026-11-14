// lib/password.ts — the strength rules behind the live checklist on
// the sign-up and set-new-password pages. Each requirement is tested
// in isolation: a password that fails exactly one of them.

import { checkPassword, isStrongPassword } from "@/lib/password";

function metIds(password: string): string[] {
  return checkPassword(password)
    .filter((requirement) => requirement.met)
    .map((requirement) => requirement.id);
}

describe("checkPassword", () => {
  it("requires at least 8 characters", () => {
    expect(metIds("Abc1!")).not.toContain("length");
    expect(metIds("Abcdef1!")).toContain("length");
  });

  it("requires one capital letter", () => {
    expect(metIds("abcdef1!")).not.toContain("uppercase");
    expect(metIds("Abcdef1!")).toContain("uppercase");
  });

  it("requires one number", () => {
    expect(metIds("Abcdefg!")).not.toContain("number");
    expect(metIds("Abcdefg1!")).toContain("number");
  });

  it("requires one special character", () => {
    expect(metIds("Abcdefg1")).not.toContain("special");
    expect(metIds("Abcdefg1!")).toContain("special");
    // Any non-letter, non-digit counts — not just the examples in
    // the label — so ? and - count too.
    expect(metIds("Abcdefg1?")).toContain("special");
    expect(metIds("Abcdefg1-")).toContain("special");
  });

  it("fails exactly one requirement at a time", () => {
    // Too short, but has a capital, a number and a special.
    expect(metIds("Abc1!")).toEqual(["uppercase", "number", "special"]);
    // Long enough, but no capital letter.
    expect(metIds("abcdefg1!")).toEqual(["length", "number", "special"]);
    // Long enough, but no number.
    expect(metIds("Abcdefg!")).toEqual(["length", "uppercase", "special"]);
    // Long enough, but no special character.
    expect(metIds("Abcdefg1")).toEqual(["length", "uppercase", "number"]);
  });

  it("reports the four requirements in order", () => {
    expect(checkPassword("").map((r) => r.label)).toEqual([
      "At least 8 characters",
      "One capital letter (A–Z)",
      "One number (0–9)",
      "One special character (e.g. !@#$%^&*)",
    ]);
  });
});

describe("isStrongPassword", () => {
  it("is false for an empty or weak password", () => {
    expect(isStrongPassword("")).toBe(false);
    expect(isStrongPassword("password")).toBe(false);
    // Has length, a capital and a number — but no special character.
    expect(isStrongPassword("Password1")).toBe(false);
  });

  it("is true only when every requirement passes", () => {
    expect(isStrongPassword("Abcdefg1!")).toBe(true);
    expect(isStrongPassword("S3cure#pass")).toBe(true);
  });
});

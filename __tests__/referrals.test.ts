// lib/referrals.ts — referral codes and links. Only the pure
// logic and the unconfigured-Supabase fallback are tested here:
// no live Supabase calls (no credentials in this workspace).
import {
  deterministicReferralCode,
  getOrCreateReferralCode,
  buildReferralLink,
} from "@/lib/referrals";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Force the unconfigured branch: without Supabase the code is
  // the deterministic fallback, so the link still displays.
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("deterministicReferralCode (unconfigured fallback)", () => {
  it("is 8 lowercase base36 chars", () => {
    const code = deterministicReferralCode("alex@example.com");
    expect(code).toMatch(/^[0-9a-z]{8}$/);
  });

  it("is stable for the same email, and case/whitespace-insensitive", () => {
    const a = deterministicReferralCode("alex@example.com");
    expect(deterministicReferralCode("alex@example.com")).toBe(a);
    expect(deterministicReferralCode("  Alex@Example.com ")).toBe(a);
  });

  it("differs for different emails", () => {
    expect(deterministicReferralCode("alex@example.com")).not.toBe(
      deterministicReferralCode("maya@example.com")
    );
  });
});

describe("getOrCreateReferralCode (unconfigured)", () => {
  it("returns the deterministic code when Supabase is unconfigured", async () => {
    await expect(
      getOrCreateReferralCode("alex@example.com")
    ).resolves.toBe(deterministicReferralCode("alex@example.com"));
  });
});

describe("buildReferralLink", () => {
  it("builds a production link with ?ref=<code> by default", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(buildReferralLink("abc12345")).toBe(
      "https://ai-chatbot-site-tawny.vercel.app/?ref=abc12345"
    );
  });

  it("prefers NEXT_PUBLIC_SITE_URL when set, without a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    expect(buildReferralLink("abc12345")).toBe(
      "https://example.com/?ref=abc12345"
    );
  });
});

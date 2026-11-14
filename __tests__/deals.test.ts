// lib/deals.ts — the coupon codes and coupon URLs behind the QR
// codes on /deals.
import { DEALS, SITE_URL, couponUrl, findDealByCode } from "@/lib/deals";

describe("deals", () => {
  it("every deal has a unique, non-empty coupon code", () => {
    const codes = DEALS.map((d) => d.code);
    expect(codes.length).toBeGreaterThan(0);
    codes.forEach((c) => expect(c).toMatch(/^[A-Z0-9]+$/));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("couponUrl points at the production deals page with the code", () => {
    expect(couponUrl(DEALS[0])).toBe(
      `${SITE_URL}/deals?coupon=${DEALS[0].code}`
    );
    expect(couponUrl(DEALS[0])).toBe(
      "https://ai-chatbot-site-tawny.vercel.app/deals?coupon=LUMEN20"
    );
  });

  it("findDealByCode matches case-insensitively and returns undefined for unknown codes", () => {
    expect(findDealByCode("lumen20")?.id).toBe("first-visit");
    expect(findDealByCode("LUMEN20")?.id).toBe("first-visit");
    expect(findDealByCode("nope")).toBeUndefined();
    expect(findDealByCode("")).toBeUndefined();
  });
});

// lib/products.ts — the shop catalogue. The nine prices below are
// the ones the 12 fictional regulars already bought; lib/customers.ts
// derives its RETAIL_PRODUCTS from this list, so these prices are
// the single source of truth for both.
import { PRODUCTS, getProduct, formatPrice } from "@/lib/products";

const SHARED_NINE: Array<[string, string, number]> = [
  ["shampoo-1l", "Shampoo (1L)", 2400],
  ["conditioner-1l", "Conditioner (1L)", 2200],
  ["colour-care-shampoo", "Colour-care shampoo", 2800],
  ["colour-care-mask", "Colour-care mask", 3200],
  ["hairspray", "Hairspray", 1800],
  ["styling-gel", "Styling gel", 1600],
  ["leave-in-treatment", "Leave-in treatment", 2600],
  ["heat-protect-spray", "Heat protect spray", 2000],
  ["beard-oil", "Beard oil", 1400],
];

describe("shared retail prices", () => {
  it.each(SHARED_NINE)(
    "%s (%s) costs $%s",
    (id, name, priceCents) => {
      const p = getProduct(id);
      expect(p).not.toBeNull();
      expect(p!.name).toBe(name);
      expect(p!.priceCents).toBe(priceCents);
      expect(formatPrice(priceCents)).toBe(`$${(priceCents / 100).toFixed(2)}`);
    }
  );

  it("the nine shared products are all present in the catalogue", () => {
    const ids = new Set(PRODUCTS.map((p) => p.id));
    for (const [id] of SHARED_NINE) expect(ids.has(id)).toBe(true);
  });

  it("product ids are unique", () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getProduct returns null for an unknown id", () => {
    expect(getProduct("no-such-product")).toBeNull();
  });
});

describe("formatPrice", () => {
  it("formats cents as dollars with two decimals", () => {
    expect(formatPrice(2400)).toBe("$24.00");
    expect(formatPrice(1400)).toBe("$14.00");
    expect(formatPrice(0)).toBe("$0.00");
  });
});

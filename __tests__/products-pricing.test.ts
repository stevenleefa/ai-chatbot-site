// lib/products.ts — sale pricing helpers. Pure logic, no Supabase:
// the client cart display and the server checkout both call these,
// so the tests below are what keep the two from ever disagreeing.
import {
  PRODUCTS,
  getProduct,
  getSalePriceCents,
  getLineTotalCents,
  getDiscountLabel,
  type Product,
} from "@/lib/products";

function productWithSale(
  priceCents: number,
  sale: Product["sale"]
): Product {
  return {
    id: "test-product",
    name: "Test product",
    description: "For pricing tests only.",
    priceCents,
    category: "Test",
    image: "",
    inStock: true,
    featured: false,
    active: true,
    sale,
  };
}

describe("starting states in the static catalogue", () => {
  it("Scalp scrub and Hair oil start out of stock, everything else in stock", () => {
    const outOfStock = PRODUCTS.filter((p) => !p.inStock).map((p) => p.id);
    expect(outOfStock.sort()).toEqual(["hair-oil", "scalp-scrub"]);
  });

  it("Colour-care mask is the one featured product", () => {
    expect(PRODUCTS.filter((p) => p.featured).map((p) => p.id)).toEqual([
      "colour-care-mask",
    ]);
  });

  it("all 15 products start active", () => {
    expect(PRODUCTS).toHaveLength(15);
    expect(PRODUCTS.every((p) => p.active)).toBe(true);
  });

  it("only Colour-care shampoo (15% off) and Shampoo (1L) (buy 2 get 1) start on sale", () => {
    const onSale = Object.fromEntries(
      PRODUCTS.filter((p) => p.sale).map((p) => [p.id, p.sale])
    );
    expect(onSale).toEqual({
      "colour-care-shampoo": { type: "percent", percent: 15 },
      "shampoo-1l": { type: "buyXGetY", buy: 2, get: 1 },
    });
  });
});

describe("getSalePriceCents", () => {
  it("percent-off rounds to the nearest cent", () => {
    // Colour-care shampoo: $28.00 at 15% off = $23.80.
    expect(getSalePriceCents(getProduct("colour-care-shampoo")!)).toBe(2380);
    // $10.01 at 15% off = $8.5085 → $8.51.
    expect(
      getSalePriceCents(productWithSale(1001, { type: "percent", percent: 15 }))
    ).toBe(851);
    // $10.00 at 33% off = $6.70.
    expect(
      getSalePriceCents(productWithSale(1000, { type: "percent", percent: 33 }))
    ).toBe(670);
  });

  it("buyXGetY and no sale keep the full unit price", () => {
    expect(getSalePriceCents(getProduct("shampoo-1l")!)).toBe(2400);
    expect(getSalePriceCents(productWithSale(2400, null))).toBe(2400);
    expect(
      getSalePriceCents(productWithSale(2400, { type: "buyXGetY", buy: 2, get: 1 }))
    ).toBe(2400);
  });
});

describe("getLineTotalCents", () => {
  it("percent-off multiplies the sale unit price by qty", () => {
    const shampoo = getProduct("colour-care-shampoo")!;
    expect(getLineTotalCents(shampoo, 1)).toBe(2380);
    expect(getLineTotalCents(shampoo, 3)).toBe(7140);
  });

  it("buy 2 get 1 free: qty 1 → pay 1, qty 2 → pay 2, qty 3 → pay 2, qty 4 → pay 3, qty 6 → pay 4", () => {
    const shampoo = getProduct("shampoo-1l")!; // $24.00
    expect(getLineTotalCents(shampoo, 1)).toBe(2400);
    expect(getLineTotalCents(shampoo, 2)).toBe(4800);
    expect(getLineTotalCents(shampoo, 3)).toBe(4800);
    expect(getLineTotalCents(shampoo, 4)).toBe(7200);
    expect(getLineTotalCents(shampoo, 5)).toBe(9600);
    expect(getLineTotalCents(shampoo, 6)).toBe(9600);
  });

  it("no sale is price × qty", () => {
    expect(getLineTotalCents(getProduct("beard-oil")!, 3)).toBe(4200);
    expect(getLineTotalCents(productWithSale(1400, null), 0)).toBe(0);
  });

  it("a malformed sale is treated as no sale, never a nonsense total", () => {
    expect(
      getLineTotalCents(productWithSale(1000, { type: "percent", percent: 150 }), 2)
    ).toBe(2000);
    expect(
      getLineTotalCents(productWithSale(1000, { type: "buyXGetY", buy: 0, get: 1 }), 3)
    ).toBe(3000);
  });
});

describe("getDiscountLabel", () => {
  it("labels percent and buyXGetY sales, and null when there is no sale", () => {
    expect(getDiscountLabel(getProduct("colour-care-shampoo")!)).toBe("15% off");
    expect(getDiscountLabel(getProduct("shampoo-1l")!)).toBe("Buy 2 get 1 free");
    expect(getDiscountLabel(getProduct("beard-oil")!)).toBeNull();
  });

  it("returns null for a malformed sale", () => {
    expect(
      getDiscountLabel(productWithSale(1000, { type: "percent", percent: 0 }))
    ).toBeNull();
    expect(
      getDiscountLabel(productWithSale(1000, { type: "buyXGetY", buy: 2, get: 0 }))
    ).toBeNull();
  });
});

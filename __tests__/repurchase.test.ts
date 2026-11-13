// lib/repurchase.ts — previously purchased + bundle price. Uses
// the real static PRODUCTS list, so the starting states (Colour-care
// shampoo 15% off, Shampoo (1L) buy 2 get 1 free, Hair oil out of
// stock) are the real ones.
import { PRODUCTS, getProduct } from "@/lib/products";
import {
  buildBundle,
  getPreviouslyPurchased,
} from "@/lib/repurchase";
import type { CustomerOrder } from "@/lib/customer-account";

function order(
  id: string,
  items: { id: string; quantity: number }[]
): CustomerOrder {
  return {
    id,
    created_at: "2026-11-10T10:00:00Z",
    customer_name: "Alex Rivera",
    customer_email: "alex@example.com",
    items: items.map((i) => ({
      id: i.id,
      name: getProduct(i.id)?.name ?? i.id,
      price_cents: getProduct(i.id)?.priceCents ?? 0,
      quantity: i.quantity,
    })),
    total_cents: 0,
    status: "paid",
  };
}

describe("getPreviouslyPurchased", () => {
  it("dedupes across orders, newest first, and skips unknown or removed ids", () => {
    const catalogue = PRODUCTS;
    const orders = [
      order("o2", [
        { id: "shampoo-1l", quantity: 1 },
        { id: "colour-care-shampoo", quantity: 1 },
      ]),
      order("o1", [
        { id: "shampoo-1l", quantity: 2 },
        { id: "gone-product", quantity: 1 },
        { id: "hair-oil", quantity: 1 },
      ]),
    ];
    const result = getPreviouslyPurchased(orders, catalogue);
    expect(result.map((p) => p.id)).toEqual([
      "shampoo-1l",
      "colour-care-shampoo",
      "hair-oil",
    ]);
  });

  it("skips a product removed from the shop (active = false)", () => {
    const catalogue = PRODUCTS.map((p) =>
      p.id === "beard-oil" ? { ...p, active: false } : p
    );
    const result = getPreviouslyPurchased(
      [order("o1", [{ id: "beard-oil", quantity: 1 }])],
      catalogue
    );
    expect(result).toEqual([]);
  });

  it("returns [] with no orders", () => {
    expect(getPreviouslyPurchased([], PRODUCTS)).toEqual([]);
  });
});

describe("buildBundle", () => {
  it("is the most recent order's products, priced with sale prices", () => {
    // Shampoo (1L) buy 2 get 1, qty 1 = full $24.00; Colour-care
    // shampoo 15% off = $23.80. Total $47.80.
    const bundle = buildBundle(
      [
        order("o2", [
          { id: "shampoo-1l", quantity: 2 },
          { id: "colour-care-shampoo", quantity: 1 },
        ]),
      ],
      PRODUCTS
    );
    expect(bundle.source).toBe("last-order");
    expect(bundle.title).toBe("Your last order, again");
    expect(bundle.products.map((p) => p.id)).toEqual([
      "shampoo-1l",
      "colour-care-shampoo",
    ]);
    expect(bundle.totalCents).toBe(2400 + 2380);
    expect(bundle.skipped).toEqual([]);
  });

  it("falls back to the curated starter set with no orders", () => {
    const bundle = buildBundle([], PRODUCTS);
    expect(bundle.source).toBe("curated");
    expect(bundle.products.map((p) => p.id)).toEqual([
      "shampoo-1l",
      "conditioner-1l",
      "leave-in-treatment",
    ]);
    // $24.00 + $22.00 + $26.00, no sales on these at qty 1.
    expect(bundle.totalCents).toBe(2400 + 2200 + 2600);
    expect(bundle.skipped).toEqual([]);
  });

  it("skips out-of-stock and removed products and names them", () => {
    const bundle = buildBundle(
      [order("o1", [{ id: "hair-oil", quantity: 1 }])],
      PRODUCTS
    );
    expect(bundle.products).toEqual([]);
    expect(bundle.skipped).toEqual(["Hair oil"]);
    expect(bundle.totalCents).toBe(0);
  });

  it("dedupes the most recent order's items", () => {
    const bundle = buildBundle(
      [
        order("o1", [
          { id: "beard-oil", quantity: 1 },
          { id: "beard-oil", quantity: 3 },
        ]),
      ],
      PRODUCTS
    );
    expect(bundle.products).toHaveLength(1);
    expect(bundle.totalCents).toBe(1400);
  });
});

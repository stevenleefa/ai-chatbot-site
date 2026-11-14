// lib/saved-carts.ts — saved-cart item validation. Pure logic
// only: no live Supabase calls (no credentials in this workspace).
import { validateSavedCartItems } from "@/lib/saved-carts";

describe("validateSavedCartItems", () => {
  it("accepts a valid items array and trims ids", () => {
    expect(
      validateSavedCartItems([
        { id: " shampoo-1l ", quantity: 2 },
        { id: "beard-oil", quantity: 1 },
      ])
    ).toEqual([
      { id: "shampoo-1l", quantity: 2 },
      { id: "beard-oil", quantity: 1 },
    ]);
  });

  it("rejects a non-array, an empty array, and more than 20 lines", () => {
    expect(validateSavedCartItems(null)).toBeNull();
    expect(validateSavedCartItems("shampoo-1l")).toBeNull();
    expect(validateSavedCartItems([])).toBeNull();
    expect(
      validateSavedCartItems(
        Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, quantity: 1 }))
      )
    ).toBeNull();
    expect(
      validateSavedCartItems(
        Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, quantity: 1 }))
      )
    ).toHaveLength(20);
  });

  it("rejects bad ids: non-strings, empty, or whitespace-only", () => {
    expect(validateSavedCartItems([{ id: 42, quantity: 1 }])).toBeNull();
    expect(validateSavedCartItems([{ id: "", quantity: 1 }])).toBeNull();
    expect(validateSavedCartItems([{ id: "   ", quantity: 1 }])).toBeNull();
    expect(validateSavedCartItems([{ quantity: 1 }])).toBeNull();
    expect(validateSavedCartItems([null])).toBeNull();
    expect(validateSavedCartItems(["shampoo-1l"])).toBeNull();
  });

  it("rejects bad quantities: 0, over 99, non-integers, non-numbers", () => {
    expect(validateSavedCartItems([{ id: "a", quantity: 0 }])).toBeNull();
    expect(validateSavedCartItems([{ id: "a", quantity: 100 }])).toBeNull();
    expect(validateSavedCartItems([{ id: "a", quantity: 1.5 }])).toBeNull();
    expect(validateSavedCartItems([{ id: "a", quantity: "2" }])).toBeNull();
    expect(validateSavedCartItems([{ id: "a" }])).toBeNull();
    expect(validateSavedCartItems([{ id: "a", quantity: 99 }])).toEqual([
      { id: "a", quantity: 99 },
    ]);
  });

  it("rejects the whole cart when any one line is bad", () => {
    expect(
      validateSavedCartItems([
        { id: "shampoo-1l", quantity: 1 },
        { id: "beard-oil", quantity: 0 },
      ])
    ).toBeNull();
  });
});

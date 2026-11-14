// Chat cart tests (lib/chat-cart.ts). The client half of the
// addToCart tool: the server validates and returns the structured
// action; this applies it to the localStorage cart ("lumen-cart",
// the shop's shape) — re-validating against the catalogue first.
import {
  applyAddToCartAction,
  applyCartActionToStorage,
  type Cart,
} from "@/lib/chat-cart";
import { CART_STORAGE_KEY } from "@/lib/products";

describe("applyAddToCartAction", () => {
  it("adds a product to an empty cart and merges with an existing line", () => {
    const first = applyAddToCartAction({}, { productId: "beard-oil", quantity: 1 });
    expect(first.ok).toBe(true);
    expect(first.cart).toEqual({ "beard-oil": 1 });

    const merged = applyAddToCartAction(first.cart, {
      productId: "beard-oil",
      quantity: 2,
    });
    expect(merged.cart).toEqual({ "beard-oil": 3 });
  });

  it("caps a line at 99, like the shop", () => {
    const cart: Cart = { "beard-oil": 98 };
    const result = applyAddToCartAction(cart, { productId: "beard-oil", quantity: 5 });
    expect(result.ok).toBe(true);
    expect(result.cart).toEqual({ "beard-oil": 99 });
  });

  it("returns the cart-action shape the widget expects", () => {
    const result = applyAddToCartAction({}, { productId: "dry-shampoo", quantity: 1 });
    expect(result.message).toBe(
      "Added Dry shampoo × 1 to your cart — view it on the shop page."
    );
  });

  it("refuses an unknown product id and leaves the cart untouched", () => {
    const cart: Cart = { "beard-oil": 1 };
    const result = applyAddToCartAction(cart, {
      productId: "no-such-product",
      quantity: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.cart).toEqual(cart);
  });

  it("refuses an out-of-stock product and leaves the cart untouched", () => {
    const cart: Cart = {};
    const result = applyAddToCartAction(cart, { productId: "hair-oil", quantity: 1 });
    expect(result.ok).toBe(false);
    expect(result.cart).toEqual({});
    expect(result.message).toContain("out of stock");
  });

  it("refuses an out-of-range quantity", () => {
    const result = applyAddToCartAction({}, { productId: "beard-oil", quantity: 0 });
    expect(result.ok).toBe(false);
  });
});

describe("applyCartActionToStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("writes the cart to localStorage under the shop's key", () => {
    const result = applyCartActionToStorage({ productId: "beard-oil", quantity: 2 });
    expect(result.ok).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({
      "beard-oil": 2,
    });
  });

  it("merges with a cart already in storage", () => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ "dry-shampoo": 1 }));
    applyCartActionToStorage({ productId: "beard-oil", quantity: 1 });
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({
      "dry-shampoo": 1,
      "beard-oil": 1,
    });
  });

  it("does not write anything when the product is out of stock", () => {
    const result = applyCartActionToStorage({ productId: "scalp-scrub", quantity: 1 });
    expect(result.ok).toBe(false);
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });
});

// Applying a chat addToCart action to the localStorage cart.
//
// The server tool (lib/tools.ts addToCart) validates the product
// and returns the structured action { action: "addToCart",
// productId, quantity }. Server code cannot write localStorage,
// so the chat widget (client) does it — but only after
// re-validating here against the same catalogue (lib/products.ts):
// the product must exist, be active and be in stock, and the
// quantity must be an integer 1–99. Anything else is refused and
// the cart is left untouched.
//
// Cart shape is exactly the shop's: Record<productId, quantity>,
// stored under CART_STORAGE_KEY ("lumen-cart"), quantities merged
// with what is already there and capped at 99 per line (same as
// components/ShopClient.tsx).

import {
  CART_STORAGE_KEY,
  getProduct,
  type Product,
} from "./products";

export type Cart = Record<string, number>;

export type AddToCartAction = {
  productId: string;
  quantity: number;
};

// Pure: validate the action against the catalogue and merge it
// into the given cart. Never throws; a refusal returns ok: false
// with the plain-language reason and the cart unchanged.
export function applyAddToCartAction(
  cart: Cart,
  action: AddToCartAction
): { ok: boolean; cart: Cart; message: string } {
  const product: Product | null = getProduct(action.productId);
  if (!product) {
    return {
      ok: false,
      cart,
      message:
        "I couldn't add that to your cart — it's no longer in the shop. Please add it from the shop page.",
    };
  }
  if (!product.active || !product.inStock) {
    return {
      ok: false,
      cart,
      message: `I couldn't add the ${product.name} to your cart — it's out of stock at the moment. Please add it from the shop page once it's back.`,
    };
  }
  const qty = action.quantity;
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return {
      ok: false,
      cart,
      message:
        "I couldn't add that to your cart — the quantity has to be a whole number from 1 to 99.",
    };
  }
  const next = {
    ...cart,
    [product.id]: Math.min(99, (cart[product.id] ?? 0) + qty),
  };
  return {
    ok: true,
    cart: next,
    message: `Added ${product.name} × ${qty} to your cart — view it on the shop page.`,
  };
}

// Read the saved cart, apply the action, write it back. Storage
// failures (private mode, corrupted JSON) leave the cart alone
// and report the refusal, so the chat never breaks over storage.
export function applyCartActionToStorage(
  action: AddToCartAction
): { ok: boolean; message: string } {
  try {
    let cart: Cart = {};
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        cart = parsed as Cart;
      }
    }
    const result = applyAddToCartAction(cart, action);
    if (!result.ok) return { ok: false, message: result.message };
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(result.cart)
    );
    return { ok: true, message: result.message };
  } catch {
    return {
      ok: false,
      message:
        "I couldn't save that to your cart — your browser storage isn't available. Please add it from the shop page.",
    };
  }
}

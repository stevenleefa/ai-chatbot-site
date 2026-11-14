// Saved carts — client-side localStorage fallback. The server
// side lives in lib/saved-carts.ts (signed-in customers, Supabase);
// this file is the client-safe half, shared by the shop's Save cart
// control (components/ShopClient.tsx) and the Saved carts section
// (components/SavedCartsSection.tsx) so both use the same key and
// shape. A signed-out visitor (or an unconfigured Supabase) saves
// under `lumen-saved-carts` on this device only — the UI always
// says so, so a local save is never mistaken for an account save.
import { CART_STORAGE_KEY } from "./products";

export const LOCAL_SAVED_CARTS_KEY = "lumen-saved-carts";

export type LocalSavedCart = {
  name: string;
  items: { id: string; quantity: number }[];
  savedAt: string; // ISO timestamp; also the local cart's key
};

export function readLocalSavedCarts(): LocalSavedCart[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_SAVED_CARTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is LocalSavedCart =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as LocalSavedCart).name === "string" &&
        Array.isArray((c as LocalSavedCart).items) &&
        typeof (c as LocalSavedCart).savedAt === "string"
    );
  } catch {
    return [];
  }
}

export function writeLocalSavedCarts(carts: LocalSavedCart[]): void {
  try {
    window.localStorage.setItem(
      LOCAL_SAVED_CARTS_KEY,
      JSON.stringify(carts)
    );
  } catch {
    // Storage unavailable — the save just lives for this page load.
  }
}

// The live cart (key `lumen-cart`, same shape ShopClient uses:
// product id -> quantity). Read/write helpers so restore and
// buy-again do not each re-implement the parse.
export function readStoredCart(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const clean: Record<string, number> = {};
    for (const [id, qty] of Object.entries(parsed)) {
      if (Number.isInteger(qty) && (qty as number) >= 1 && (qty as number) <= 99) {
        clean[id] = qty as number;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function writeStoredCart(cart: Record<string, number>): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage unavailable — the cart just lives for this page load.
  }
}

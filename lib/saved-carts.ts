// Saved carts — server-only helpers (imports lib/supabase.ts, so
// never import this from a client component).
//
// A signed-in customer can save a cart under a label of their own
// choosing ("Monthly restock") and restore or delete it later from
// /my-account. Items are stored as jsonb: an array of
// { id, quantity }. The localStorage fallback for signed-out
// visitors (or an unconfigured Supabase) is a client concern for a
// later step — these helpers only cover the server side.
//
// Nothing here throws to the caller in a way that breaks the page:
// a failed save returns null, a failed list returns [], a failed
// lookup/delete returns null/false. Ownership is always checked by
// the customer's (verified session) email — a saved cart is only
// ever listed, read or deleted for the email it belongs to.

import { getServerSupabase, isSupabaseConfigured } from "./supabase";

export type SavedCartItem = {
  id: string;
  quantity: number;
};

export type SavedCart = {
  id: string;
  customer_email: string;
  name: string;
  items: SavedCartItem[];
  created_at: string;
  updated_at: string;
};

const MAX_ITEMS = 20;
const MAX_QUANTITY = 99;
const MAX_NAME = 100;

// Validate a saved-cart items array server-side: at most 20 lines,
// each line an object with a non-empty string id and an integer
// quantity 1–99. Returns the cleaned items, or null when invalid.
// Exported so it can be unit-tested without Supabase.
export function validateSavedCartItems(items: unknown): SavedCartItem[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return null;
  }
  const cleaned: SavedCartItem[] = [];
  for (const line of items) {
    if (typeof line !== "object" || line === null || Array.isArray(line)) {
      return null;
    }
    const { id, quantity } = line as Record<string, unknown>;
    if (typeof id !== "string" || id.trim().length === 0) return null;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return null;
    }
    cleaned.push({ id: id.trim(), quantity });
  }
  return cleaned;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function saveCart(
  email: string,
  name: string,
  items: unknown
): Promise<SavedCart | null> {
  const normalizedEmail = normalizeEmail(email);
  const label = typeof name === "string" ? name.trim() : "";
  const validItems = validateSavedCartItems(items);
  if (!normalizedEmail || label.length === 0 || label.length > MAX_NAME) {
    return null;
  }
  if (!validItems || !isSupabaseConfigured()) return null;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("saved_carts")
      .insert({
        customer_email: normalizedEmail,
        name: label,
        items: validItems,
      })
      .select("id,customer_email,name,items,created_at,updated_at")
      .limit(1);
    if (error || !data || data.length === 0) {
      if (error) console.error("Failed to save cart:", error.message);
      return null;
    }
    return data[0] as SavedCart;
  } catch (err) {
    console.error("Failed to save cart:", err);
    return null;
  }
}

// The customer's saved carts, newest first.
export async function listSavedCarts(email: string): Promise<SavedCart[]> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !isSupabaseConfigured()) return [];
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("saved_carts")
      .select("id,customer_email,name,items,created_at,updated_at")
      .eq("customer_email", normalizedEmail)
      .order("created_at", { ascending: false });
    if (error || !data) {
      if (error) console.error("Failed to list saved carts:", error.message);
      return [];
    }
    return data as SavedCart[];
  } catch (err) {
    console.error("Failed to list saved carts:", err);
    return [];
  }
}

// One saved cart, only when it belongs to this email.
export async function getSavedCart(
  email: string,
  id: string
): Promise<SavedCart | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !id || !isSupabaseConfigured()) return null;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("saved_carts")
      .select("id,customer_email,name,items,created_at,updated_at")
      .eq("customer_email", normalizedEmail)
      .eq("id", id)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0] as SavedCart;
  } catch (err) {
    console.error("Failed to get saved cart:", err);
    return null;
  }
}

// Delete a saved cart, only when it belongs to this email. True
// when a row was deleted, false otherwise.
export async function deleteSavedCart(
  email: string,
  id: string
): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !id || !isSupabaseConfigured()) return false;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("saved_carts")
      .delete()
      .eq("customer_email", normalizedEmail)
      .eq("id", id)
      .select("id");
    if (error || !data) {
      if (error) console.error("Failed to delete saved cart:", error.message);
      return false;
    }
    return data.length > 0;
  } catch (err) {
    console.error("Failed to delete saved cart:", err);
    return false;
  }
}

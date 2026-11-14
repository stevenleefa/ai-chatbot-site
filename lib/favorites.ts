// Favorite products — server-only helpers (imports lib/supabase.ts,
// so never import this from a client component).
//
// A signed-in customer can favorite products from the shop and see
// them on /settings. Favorites are a many-to-many (one customer,
// many products; one product, many customers), so they live in their
// own table `user_favorites` (user_id, product_id, created_at) — not
// an array column on the preferences row. The table is created by
// supabase/user-favorites-schema.sql (RLS on, no public policies;
// the service-role key bypasses RLS, so only the site's own server
// code touches it — the same pattern as saved_carts/referrals).
//
// Ownership is always the verified session user id — a favorite is
// only ever listed, added or removed for the id it belongs to.
// Product ids are validated against the static catalogue
// (lib/products.ts): an unknown id is rejected before any DB call.
//
// Nothing here throws to the caller in a way that breaks the page:
// a failed list returns [], a failed add/remove returns false.

import { getServerSupabase, isSupabaseConfigured } from "./supabase";
import { getProduct } from "./products";

/** A product id is favoritable only when it is a real catalogue id. */
export function isValidFavoriteProductId(productId: unknown): boolean {
  return typeof productId === "string" && getProduct(productId) !== null;
}

// The customer's favorite product ids, oldest first.
export async function listFavoriteProductIds(
  userId: string,
): Promise<string[]> {
  if (!userId || !isSupabaseConfigured()) return [];
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("user_favorites")
      .select("product_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error || !data) {
      if (error) console.error("Failed to list favorites:", error.message);
      return [];
    }
    return (data as { product_id: string }[]).map((r) => r.product_id);
  } catch (err) {
    console.error("Failed to list favorites:", err);
    return [];
  }
}

// Favorite one product. True when the row now exists (already
// favorited counts as true — the call is idempotent). False when
// the id is unknown or the save failed.
export async function addFavorite(
  userId: string,
  productId: string,
): Promise<boolean> {
  if (!userId || !isValidFavoriteProductId(productId)) return false;
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase!
      .from("user_favorites")
      .upsert(
        { user_id: userId, product_id: productId },
        { onConflict: "user_id,product_id" },
      );
    if (error) {
      console.error("Failed to add favorite:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to add favorite:", err);
    return false;
  }
}

// Remove one favorite. True when a row was deleted (or was never
// there — removing a non-favorite is a no-op, not an error). False
// when the id is unknown or the delete failed.
export async function removeFavorite(
  userId: string,
  productId: string,
): Promise<boolean> {
  if (!userId || !isValidFavoriteProductId(productId)) return false;
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase!
      .from("user_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) {
      console.error("Failed to remove favorite:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to remove favorite:", err);
    return false;
  }
}

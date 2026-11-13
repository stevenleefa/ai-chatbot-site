"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth/session";
import { assertNotDemo } from "@/lib/auth/demo";
import {
  saleToColumns,
  slugifyProductName,
  validateProductFields,
} from "@/lib/product-validation";

// Admin-only server actions for /admin/products. Every action
// re-checks that the caller is an active admin (defence in depth
// behind the middleware and the page check), and writes with the
// service-role client. Test Admin Mode (demo mode, see DEMO_MODE.md):
// every action refuses in demo mode FIRST, before any Supabase call,
// so a demo visitor can never change a product — the buttons are
// disabled on the page, and this is the server-side backstop for a
// forged POST. Errors are plain-English and never leak Supabase
// error text (same pattern as app/admin/actions.ts).

// The edit/add forms submit prices in dollars and stock as a
// select ("in" / "out"); the sale comes as a type plus its numbers.
// Only the numbers for the chosen sale type are read — the rest of
// the form leaves them blank and parseSale ignores them.
function readFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    price: String(formData.get("price") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    image: String(formData.get("image") ?? ""),
    inStock: String(formData.get("inStock") ?? "") === "in",
    saleType: String(formData.get("saleType") ?? "none"),
    salePercent: String(formData.get("salePercent") ?? ""),
    saleBuy: String(formData.get("saleBuy") ?? ""),
    saleGet: String(formData.get("saleGet") ?? ""),
  };
}

function revalidateProducts() {
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

// Clear the featured flag on every product that has it. The
// products table has a partial unique index allowing at most one
// featured product, so an action that features a product must run
// this FIRST — featuring without it would fail on the constraint.
async function unfeatureAll(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ featured: false })
    .eq("featured", true);
  if (error) throw new Error("Could not update the featured product.");
}

// Edit a product: name, price (dollars in the form, stored as
// integer cents), description, category, image URL, stock status
// and sale offer. Featured is NOT edited here — it changes only
// through setFeaturedProduct below, so the un-feature-first rule
// lives in one place.
export async function updateProduct(formData: FormData) {
  await assertNotDemo();
  const session = await requireRole("admin");
  if (!session) throw new Error("Admins only.");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A product is required.");
  const fields = validateProductFields(readFields(formData));
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("Product storage is not configured.");
  const { data: existing, error: readError } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .limit(1);
  if (readError) throw new Error("Could not load the product.");
  if (!existing || existing.length === 0) {
    throw new Error("Product not found.");
  }
  const { error } = await supabase
    .from("products")
    .update({
      name: fields.name,
      description: fields.description,
      price_cents: fields.priceCents,
      category: fields.category,
      image: fields.image,
      in_stock: fields.inStock,
      ...saleToColumns(fields.sale),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Could not update the product.");
  revalidateProducts();
}

// Remove a product from the shop (active = false) or bring it back
// (active = true). The row is never deleted — past orders reference
// product ids. Removing a product also clears its featured flag, so
// a product nobody can see cannot hold the shop's one featured slot;
// re-activating does not restore it (feature it again if wanted).
export async function setProductActive(formData: FormData) {
  await assertNotDemo();
  const session = await requireRole("admin");
  if (!session) throw new Error("Admins only.");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) throw new Error("A product is required.");
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("Product storage is not configured.");
  const { error } = await supabase
    .from("products")
    .update({
      active,
      ...(active ? {} : { featured: false }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Could not update the product.");
  revalidateProducts();
}

// Add a new product — how the admin swaps one out for another:
// remove the old one above, add the replacement here. The id is a
// URL-safe slug made from the name, and is rejected if that id
// already exists. A new product starts unfeatured and in the shop
// (active); feature it from its row afterwards if it is the one.
export async function addProduct(formData: FormData) {
  await assertNotDemo();
  const session = await requireRole("admin");
  if (!session) throw new Error("Admins only.");
  const fields = validateProductFields(readFields(formData));
  const id = slugifyProductName(fields.name);
  if (!id) {
    throw new Error("Product name must contain letters or numbers.");
  }
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("Product storage is not configured.");
  const { data: existing, error: readError } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .limit(1);
  if (readError) throw new Error("Could not check the product name.");
  if (existing && existing.length > 0) {
    throw new Error(
      "A product with that name already exists — pick a different name."
    );
  }
  const { error } = await supabase.from("products").insert({
    id,
    name: fields.name,
    description: fields.description,
    price_cents: fields.priceCents,
    category: fields.category,
    image: fields.image,
    in_stock: fields.inStock,
    featured: false,
    active: true,
    ...saleToColumns(fields.sale),
  });
  if (error) throw new Error("Could not add the product.");
  revalidateProducts();
}

// Feature one product: un-feature the current featured product
// FIRST (the partial unique index allows at most one), then feature
// the chosen one. A removed product cannot be featured — re-activate
// it first — so the featured slot is never held by a product the
// shop does not show.
export async function setFeaturedProduct(formData: FormData) {
  await assertNotDemo();
  const session = await requireRole("admin");
  if (!session) throw new Error("Admins only.");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A product is required.");
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("Product storage is not configured.");
  const { data: existing, error: readError } = await supabase
    .from("products")
    .select("id, active")
    .eq("id", id)
    .limit(1);
  if (readError) throw new Error("Could not load the product.");
  if (!existing || existing.length === 0) {
    throw new Error("Product not found.");
  }
  if (!existing[0].active) {
    throw new Error(
      "Removed products cannot be featured — re-activate it first."
    );
  }
  await unfeatureAll(supabase);
  const { error } = await supabase
    .from("products")
    .update({ featured: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Could not feature the product.");
  revalidateProducts();
}

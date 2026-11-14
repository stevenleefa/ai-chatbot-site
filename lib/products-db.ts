// Products from Supabase — server-only (imports lib/supabase.ts,
// which holds the service-role key, so this file must never be
// imported by a client component).
//
// The shop page and the checkout route switch to these helpers so
// the admin's product edits (stock, featured, sales, removals in
// /admin/products) take effect. When Supabase is unconfigured, or
// the query errors, they fall back to the static PRODUCTS list in
// lib/products.ts — the shop never crashes for a database problem.

import { getServerSupabase, isSupabaseConfigured } from "./supabase";
import { PRODUCTS, type Product, type ProductSale } from "./products";

// One row of public.products, as Supabase returns it.
type ProductRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  image: string;
  in_stock: boolean;
  featured: boolean;
  active: boolean;
  sale_type: string | null;
  sale_percent: number | null;
  sale_buy: number | null;
  sale_get: number | null;
};

function rowToProduct(row: ProductRow): Product {
  let sale: ProductSale | null = null;
  if (row.sale_type === "percent" && typeof row.sale_percent === "number") {
    sale = { type: "percent", percent: row.sale_percent };
  } else if (
    row.sale_type === "buyXGetY" &&
    typeof row.sale_buy === "number" &&
    typeof row.sale_get === "number"
  ) {
    sale = { type: "buyXGetY", buy: row.sale_buy, get: row.sale_get };
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    image: row.image,
    inStock: row.in_stock,
    featured: row.featured,
    active: row.active,
    sale,
  };
}

// The full catalogue from the products table, or the static PRODUCTS
// fallback when Supabase is unconfigured or the query fails.
export async function getCatalogue(): Promise<Product[]> {
  if (!isSupabaseConfigured()) return PRODUCTS;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("products")
      .select(
        "id,name,description,price_cents,category,image,in_stock,featured,active,sale_type,sale_percent,sale_buy,sale_get"
      )
      .order("name", { ascending: true });
    if (error || !data) {
      console.error("Failed to load products catalogue:", error?.message);
      return PRODUCTS;
    }
    return (data as ProductRow[]).map(rowToProduct);
  } catch (err) {
    console.error("Failed to load products catalogue:", err);
    return PRODUCTS;
  }
}

// One product by id, from the same source as getCatalogue.
export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) {
    return PRODUCTS.find((p) => p.id === id) ?? null;
  }
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("products")
      .select(
        "id,name,description,price_cents,category,image,in_stock,featured,active,sale_type,sale_percent,sale_buy,sale_get"
      )
      .eq("id", id)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return rowToProduct(data[0] as ProductRow);
  } catch (err) {
    console.error("Failed to load product:", err);
    return null;
  }
}

// Previously purchased + "Complete the routine" bundle — pure
// logic over the customer's orders and the catalogue, so it can be
// unit-tested without Supabase. The /my-account page calls these
// server-side (with the catalogue from lib/products-db.ts, so an
// admin edit to stock/sales is reflected) and hands the resulting
// products to the client RepurchaseSection, which adds them to the
// localStorage cart.
//
// Previously purchased: the unique products across the customer's
// orders (newest order first), looked up in the catalogue. An id
// that no longer exists, or a product that was removed from the
// shop (active = false), is skipped — a past order referencing a
// gone product must not break the page. Out-of-stock products are
// kept in the list but their Buy again button is disabled in the
// client component, so the customer sees why they cannot re-buy.
//
// Bundle ("Complete the routine"): one tap adds the whole set to
// the cart. When the customer has a previous order it is the
// products from their MOST RECENT order ("Your last order, again");
// otherwise it is the curated starter set — Shampoo (1L) +
// Conditioner (1L) + Leave-in treatment. The bundle price is the
// sum of getLineTotalCents(product, 1) per product, so sale prices
// apply exactly as the shop and checkout price them. Products that
// are out of stock or removed are skipped and named in `skipped`,
// so the card can say so instead of silently charging for less.
import {
  getLineTotalCents,
  type Product,
} from "./products";
import type { CustomerOrder } from "./customer-account";

export const CURATED_BUNDLE_IDS = [
  "shampoo-1l",
  "conditioner-1l",
  "leave-in-treatment",
] as const;

export function getPreviouslyPurchased(
  orders: CustomerOrder[],
  catalogue: Product[]
): Product[] {
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const product = byId.get(item.id);
      // Gone from the catalogue, or removed from the shop: skip.
      if (!product || !product.active) continue;
      result.push(product);
    }
  }
  return result;
}

export type Bundle = {
  source: "last-order" | "curated";
  title: string;
  products: Product[];
  skipped: string[];
  totalCents: number;
};

export function buildBundle(
  orders: CustomerOrder[],
  catalogue: Product[]
): Bundle {
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  const hasOrder = orders.length > 0;
  const ids: string[] = hasOrder
    ? Array.from(
        new Set((orders[0].items ?? []).map((item) => item.id))
      )
    : [...CURATED_BUNDLE_IDS];
  const products: Product[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    const product = byId.get(id);
    if (!product || !product.active || !product.inStock) {
      // Name it when we can, so the card can say what was left out.
      skipped.push(product ? product.name : id);
      continue;
    }
    products.push(product);
  }
  return {
    source: hasOrder ? "last-order" : "curated",
    title: hasOrder ? "Your last order, again" : "The starter routine",
    products,
    skipped,
    totalCents: products.reduce(
      (sum, p) => sum + getLineTotalCents(p, 1),
      0
    ),
  };
}

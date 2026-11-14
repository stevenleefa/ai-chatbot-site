// Pure validation + slug logic for the admin products page
// (/admin/products). No imports with side effects and no Supabase —
// so Jest can test it directly. The server actions in
// app/admin/products/actions.ts import these; they cannot live in
// that file because a "use server" file may only export async
// functions (Next.js rejects sync exports from one at build time).
import type { ProductSale } from "./products";

// Dollars from the form (a string like "24.99", or a number) to
// integer cents for storage. Null when the value is not a usable
// price: empty, not a number, or below zero. Rounds to the nearest
// cent ("24.995" becomes 2500).
export function dollarsToCents(value: string | number): number | null {
  if (typeof value === "string") {
    // Number("") and Number("   ") are both 0, so a blank price must
    // be rejected before converting — otherwise an empty price field
    // would silently become $0.
    if (value.trim() === "") return null;
    const dollars = Number(value.trim());
    if (!Number.isFinite(dollars) || dollars < 0) return null;
    return Math.round(dollars * 100);
  }
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

// The product id is a URL-safe slug made from the name: lowercase,
// every run of non-alphanumeric characters becomes one hyphen, and
// leading/trailing hyphens are stripped. "Shampoo (1L)" becomes
// "shampoo-1l". A name with no letters or numbers at all ("!!!")
// becomes "" — the add action rejects that.
export function slugifyProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// An image URL must be empty (keep whatever image is there / no
// image yet) or start with https:// — the catalogue photos are
// Unsplash URLs, and anything else (http://, a relative path, a
// javascript: URL) is rejected.
export function isValidImageUrl(url: string): boolean {
  return url === "" || url.startsWith("https://");
}

// The sale offer from the form's three fields. "none" (or an empty
// type) means no sale. A percent sale needs a whole-number percent
// from 1 to 99; a buy-X-get-Y sale needs whole-number buy/get from
// 1 to 99. Anything else throws a plain-English error — the server
// action surfaces it, and the admin fixes the form.
export function parseSale(input: {
  type: string;
  percent: string;
  buy: string;
  get: string;
}): ProductSale | null {
  if (input.type === "none" || input.type === "") return null;
  if (input.type === "percent") {
    const percent = Number(input.percent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
      throw new Error("Percent off must be a whole number from 1 to 99.");
    }
    return { type: "percent", percent };
  }
  if (input.type === "buyXGetY") {
    const buy = Number(input.buy);
    const get = Number(input.get);
    if (!Number.isInteger(buy) || buy < 1 || buy > 99) {
      throw new Error("Buy quantity must be a whole number from 1 to 99.");
    }
    if (!Number.isInteger(get) || get < 1 || get > 99) {
      throw new Error(
        "Free quantity must be a whole number from 1 to 99."
      );
    }
    return { type: "buyXGetY", buy, get };
  }
  throw new Error("Sale type must be none, percent, or buy X get Y free.");
}

export type ProductFields = {
  name: string;
  priceCents: number;
  description: string;
  category: string;
  image: string;
  inStock: boolean;
  sale: ProductSale | null;
};

// Everything the edit and add forms submit, validated in one place
// so both actions enforce the same rules: name 1–100 chars, price a
// number of dollars 0 or more, description at most 500 chars,
// category 1–100 chars, image empty or https://, sale per parseSale.
// Featured is deliberately NOT one of these fields: it is changed
// only with the per-product "Make featured" button
// (setFeaturedProduct in app/admin/products/actions.ts), so the
// un-feature-first rule lives in one place. Throws a plain-English
// Error on the first bad field.
export function validateProductFields(input: {
  name: string;
  price: string;
  description: string;
  category: string;
  image: string;
  inStock: boolean;
  saleType: string;
  salePercent: string;
  saleBuy: string;
  saleGet: string;
}): ProductFields {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 100) {
    throw new Error("Name must be between 1 and 100 characters.");
  }
  const priceCents = dollarsToCents(input.price);
  if (priceCents === null) {
    throw new Error("Price must be a number of dollars, 0 or more.");
  }
  const description = input.description.trim();
  if (description.length > 500) {
    throw new Error("Description must be 500 characters or fewer.");
  }
  const category = input.category.trim();
  if (category.length < 1 || category.length > 100) {
    throw new Error("Category must be between 1 and 100 characters.");
  }
  const image = input.image.trim();
  if (!isValidImageUrl(image)) {
    throw new Error("Image URL must be empty or start with https://.");
  }
  const sale = parseSale({
    type: input.saleType,
    percent: input.salePercent,
    buy: input.saleBuy,
    get: input.saleGet,
  });
  return {
    name,
    priceCents,
    description,
    category,
    image,
    inStock: input.inStock,
    sale,
  };
}

// A validated sale, split into the four products-table columns
// (sale_type / sale_percent / sale_buy / sale_get). No sale clears
// all four, so an edited-out offer leaves no stale numbers behind.
export function saleToColumns(sale: ProductSale | null): {
  sale_type: string | null;
  sale_percent: number | null;
  sale_buy: number | null;
  sale_get: number | null;
} {
  if (!sale) {
    return {
      sale_type: null,
      sale_percent: null,
      sale_buy: null,
      sale_get: null,
    };
  }
  if (sale.type === "percent") {
    return {
      sale_type: "percent",
      sale_percent: sale.percent,
      sale_buy: null,
      sale_get: null,
    };
  }
  return {
    sale_type: "buyXGetY",
    sale_percent: null,
    sale_buy: sale.buy,
    sale_get: sale.get,
  };
}

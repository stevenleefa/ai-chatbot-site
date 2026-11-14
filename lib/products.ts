// Shop catalogue — the single source of truth for retail product
// names and prices. The nine products the 12 fictional regulars
// already bought (lib/customers.ts RETAIL_PRODUCTS) live here now,
// at exactly the same prices; the extra products below are new to
// the shop. lib/customers.ts derives its RETAIL_PRODUCTS record from
// this list, so there is exactly one copy of each price and the
// customers code and the shop can never disagree.
//
// Prices are in cents (Stripe takes integer cents); display them in
// dollars with formatPrice(). Client-safe: no data imports, so the
// shop's client components can import this file.
//
// The static PRODUCTS list below is also the FALLBACK catalogue:
// lib/products-db.ts reads the `products` table from Supabase when
// it is configured and falls back to this list otherwise, so the
// shop works with no Supabase at all. Keep the two in sync — the
// seed in supabase/products-schema.sql carries the same starting
// states (stock, featured, sales) as the entries below.

export type ProductSale =
  | { type: "percent"; percent: number }
  | { type: "buyXGetY"; buy: number; get: number };

export type Product = {
  id: string; // URL-safe slug, used in the cart and the Stripe line items
  name: string;
  description: string;
  priceCents: number;
  category: string;
  image: string; // Unsplash stock photo (direct images.unsplash.com URL, freely usable)
  inStock: boolean; // false = out of stock; the shop shows it but cannot sell it
  featured: boolean; // true = the one featured product on the shop page
  active: boolean; // false = removed from the shop (never delete the row — orders reference product ids)
  sale?: ProductSale | null; // null = no sale
};

// The shop's cart is saved under this key in localStorage so it
// survives a refresh (and is cleared after a successful checkout).
export const CART_STORAGE_KEY = "lumen-cart";

export const PRODUCTS: Product[] = [
  // The nine the regulars already bought — same names, same prices
  // as RETAIL_PRODUCTS used to carry (verified against
  // lib/customers.ts before the move).
  {
    id: "shampoo-1l",
    name: "Shampoo (1L)",
    description: "The studio's everyday shampoo — gentle, for all hair types.",
    priceCents: 2400,
    category: "Hair care",
    image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: { type: "buyXGetY", buy: 2, get: 1 },
  },
  {
    id: "conditioner-1l",
    name: "Conditioner (1L)",
    description: "The matching conditioner — soft, detangled hair after every wash.",
    priceCents: 2200,
    category: "Hair care",
    image: "https://images.unsplash.com/photo-1519735777090-ec97162dc266?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "colour-care-shampoo",
    name: "Colour-care shampoo",
    description: "Sulphate-free wash that keeps colour vivid for longer.",
    priceCents: 2800,
    category: "Colour care",
    image: "https://images.unsplash.com/photo-1601070846144-6be3aad73f7b?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: { type: "percent", percent: 15 },
  },
  {
    id: "colour-care-mask",
    name: "Colour-care mask",
    description: "A weekly deep mask for coloured hair — soft, shiny, protected.",
    priceCents: 3200,
    category: "Colour care",
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: true,
    active: true,
    sale: null,
  },
  {
    id: "hairspray",
    name: "Hairspray",
    description: "Flexible hold that brushes out — no crunch, no stiffness.",
    priceCents: 1800,
    category: "Styling",
    image: "https://images.unsplash.com/photo-1629458681434-e321fc1fd906?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "styling-gel",
    name: "Styling gel",
    description: "A versatile gel for definition, texture and all-day hold.",
    priceCents: 1600,
    category: "Styling",
    image: "https://images.unsplash.com/photo-1556217256-dcd735bb8711?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "leave-in-treatment",
    name: "Leave-in treatment",
    description: "Leave-in softness for dry ends — especially after balayage.",
    priceCents: 2600,
    category: "Treatment",
    image: "https://images.unsplash.com/photo-1597354984706-fac992d9306f?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "heat-protect-spray",
    name: "Heat protect spray",
    description: "Shields hair from heat styling and keeps colour from fading.",
    priceCents: 2000,
    category: "Styling",
    image: "https://images.unsplash.com/photo-1593560368818-bd0c238ef976?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "beard-oil",
    name: "Beard oil",
    description: "Keeps a beard soft and tidy between trims — a little goes a long way.",
    priceCents: 1400,
    category: "Beard care",
    image: "https://images.unsplash.com/photo-1627875777089-d32f1127e9ff?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  // New to the shop — plausible salon retail, priced in line with
  // the range above.
  {
    id: "styling-cream",
    name: "Styling cream",
    description: "A light cream for smooth, frizz-free styling with a natural finish.",
    priceCents: 1900,
    category: "Styling",
    image: "https://images.unsplash.com/photo-1547997825-ac153dc46a97?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "dry-shampoo",
    name: "Dry shampoo",
    description: "Refreshes hair between washes — volume and a clean feel, no water.",
    priceCents: 1700,
    category: "Styling",
    image: "https://images.unsplash.com/photo-1610595426075-eed5a3f521ee?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "hair-oil",
    name: "Hair oil",
    description: "A few drops for shine and smoothness on dry or frizzy hair.",
    priceCents: 2500,
    category: "Treatment",
    image: "https://images.unsplash.com/photo-1591130901921-3f0652bb3915?w=800&q=80&auto=format&fit=crop",
    inStock: false,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "scalp-scrub",
    name: "Scalp scrub",
    description: "A gentle weekly scrub for a healthy scalp and lighter-feeling hair.",
    priceCents: 2100,
    category: "Hair care",
    image: "https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=800&q=80&auto=format&fit=crop",
    inStock: false,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "colour-care-gift-set",
    name: "Colour care gift set",
    description: "Colour-care shampoo + colour-care mask, boxed — the gift for coloured hair.",
    priceCents: 5600,
    category: "Gift sets",
    image: "https://images.unsplash.com/photo-1592150282082-37698debe277?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
  {
    id: "everyday-gift-set",
    name: "Everyday gift set",
    description: "Shampoo, conditioner and styling gel, boxed — the everyday trio.",
    priceCents: 4400,
    category: "Gift sets",
    image: "https://images.unsplash.com/photo-1451443700141-5ddb6d85a8fc?w=800&q=80&auto=format&fit=crop",
    inStock: true,
    featured: false,
    active: true,
    sale: null,
  },
];

export function getProduct(id: string): Product | null {
  return PRODUCTS.find((p) => p.id === id) ?? null;
}

export function formatPrice(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

// --- Sale pricing -----------------------------------------------------------
//
// Pure helpers, shared by the client cart display AND the server
// checkout — both call these, so the price a shopper sees and the
// price Stripe charges can never disagree. A buyXGetY sale does not
// change the unit price (the free units come off the line total).

// Unit price after a percent-off sale, rounded to the nearest cent.
// For a buyXGetY sale (and no sale) it is the full priceCents.
export function getSalePriceCents(product: Product): number {
  const sale = product.sale;
  if (sale && sale.type === "percent") {
    return Math.round((product.priceCents * (100 - sale.percent)) / 100);
  }
  return product.priceCents;
}

// Total for a line of `quantity` units. Percent-off uses the sale
// unit price × qty. BuyXGetY charges only for the paid units:
// qty − floor(qty / (buy + get)) × get (buy 2 get 1: qty 3 → pay 2,
// qty 4 → pay 3, qty 6 → pay 4). No sale is priceCents × qty.
// A malformed sale (buy/get not positive integers, percent out of
// 0–100) is treated as no sale rather than producing a nonsense total.
export function getLineTotalCents(product: Product, quantity: number): number {
  const qty = Math.max(0, Math.floor(quantity));
  const sale = product.sale;
  if (sale && sale.type === "percent") {
    if (sale.percent <= 0 || sale.percent > 100) return product.priceCents * qty;
    return getSalePriceCents(product) * qty;
  }
  if (sale && sale.type === "buyXGetY") {
    if (
      !Number.isInteger(sale.buy) ||
      !Number.isInteger(sale.get) ||
      sale.buy <= 0 ||
      sale.get <= 0
    ) {
      return product.priceCents * qty;
    }
    const group = sale.buy + sale.get;
    const freeUnits = Math.floor(qty / group) * sale.get;
    return (qty - freeUnits) * product.priceCents;
  }
  return product.priceCents * qty;
}

// Human text for the sale ribbon on a product card, e.g. "15% off"
// or "Buy 2 get 1 free". Null when there is no sale (or the sale is
// malformed — the ribbon must never show a nonsense offer).
export function getDiscountLabel(product: Product): string | null {
  const sale = product.sale;
  if (!sale) return null;
  if (sale.type === "percent") {
    if (sale.percent <= 0 || sale.percent > 100) return null;
    return `${sale.percent}% off`;
  }
  if (sale.type === "buyXGetY") {
    if (
      !Number.isInteger(sale.buy) ||
      !Number.isInteger(sale.get) ||
      sale.buy <= 0 ||
      sale.get <= 0
    ) {
      return null;
    }
    return `Buy ${sale.buy} get ${sale.get} free`;
  }
  return null;
}

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

export type Product = {
  id: string; // URL-safe slug, used in the cart and the Stripe line items
  name: string;
  description: string;
  priceCents: number;
  category: string;
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
  },
  {
    id: "conditioner-1l",
    name: "Conditioner (1L)",
    description: "The matching conditioner — soft, detangled hair after every wash.",
    priceCents: 2200,
    category: "Hair care",
  },
  {
    id: "colour-care-shampoo",
    name: "Colour-care shampoo",
    description: "Sulphate-free wash that keeps colour vivid for longer.",
    priceCents: 2800,
    category: "Colour care",
  },
  {
    id: "colour-care-mask",
    name: "Colour-care mask",
    description: "A weekly deep mask for coloured hair — soft, shiny, protected.",
    priceCents: 3200,
    category: "Colour care",
  },
  {
    id: "hairspray",
    name: "Hairspray",
    description: "Flexible hold that brushes out — no crunch, no stiffness.",
    priceCents: 1800,
    category: "Styling",
  },
  {
    id: "styling-gel",
    name: "Styling gel",
    description: "A versatile gel for definition, texture and all-day hold.",
    priceCents: 1600,
    category: "Styling",
  },
  {
    id: "leave-in-treatment",
    name: "Leave-in treatment",
    description: "Leave-in softness for dry ends — especially after balayage.",
    priceCents: 2600,
    category: "Treatment",
  },
  {
    id: "heat-protect-spray",
    name: "Heat protect spray",
    description: "Shields hair from heat styling and keeps colour from fading.",
    priceCents: 2000,
    category: "Styling",
  },
  {
    id: "beard-oil",
    name: "Beard oil",
    description: "Keeps a beard soft and tidy between trims — a little goes a long way.",
    priceCents: 1400,
    category: "Beard care",
  },
  // New to the shop — plausible salon retail, priced in line with
  // the range above.
  {
    id: "styling-cream",
    name: "Styling cream",
    description: "A light cream for smooth, frizz-free styling with a natural finish.",
    priceCents: 1900,
    category: "Styling",
  },
  {
    id: "dry-shampoo",
    name: "Dry shampoo",
    description: "Refreshes hair between washes — volume and a clean feel, no water.",
    priceCents: 1700,
    category: "Styling",
  },
  {
    id: "hair-oil",
    name: "Hair oil",
    description: "A few drops for shine and smoothness on dry or frizzy hair.",
    priceCents: 2500,
    category: "Treatment",
  },
  {
    id: "scalp-scrub",
    name: "Scalp scrub",
    description: "A gentle weekly scrub for a healthy scalp and lighter-feeling hair.",
    priceCents: 2100,
    category: "Hair care",
  },
  {
    id: "colour-care-gift-set",
    name: "Colour care gift set",
    description: "Colour-care shampoo + colour-care mask, boxed — the gift for coloured hair.",
    priceCents: 5600,
    category: "Gift sets",
  },
  {
    id: "everyday-gift-set",
    name: "Everyday gift set",
    description: "Shampoo, conditioner and styling gel, boxed — the everyday trio.",
    priceCents: 4400,
    category: "Gift sets",
  },
];

export function getProduct(id: string): Product | null {
  return PRODUCTS.find((p) => p.id === id) ?? null;
}

export function formatPrice(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

// Public reviews — seed data + display helpers. Pure data, no
// Supabase import, so client components (the pop-ups, the review
// form) can import this file. Visitor reviews live in the
// public.reviews table (supabase/reviews-schema.sql) and are combined
// with the seeds by lib/reviews-server.ts (server only).
//
// The seed reviews are DEMO data: short 5-star quotes from the 12
// fictional regulars, each naming a service that regular actually had
// (checked against lib/customers.ts — every name below had that
// service in their procedures). The owner replaces them with real
// reviews — see REVIEWS.md.

export type SeedReview = {
  id: string;
  name: string;
  service: string;
  rating: 5;
  text: string;
  createdAt: string; // YYYY-MM-DD — seeds sort with visitor reviews, newest first
};

export const SEED_REVIEWS: SeedReview[] = [
  {
    id: "seed-emma",
    name: "Emma Thompson",
    service: "Full colour",
    rating: 5,
    text: "My colour is exactly what I asked for, and it still looks fresh weeks later.",
    createdAt: "2026-10-05",
  },
  {
    id: "seed-grace",
    name: "Grace Liu",
    service: "Haircut",
    rating: 5,
    text: "Best haircut I've had in years. I walked out feeling like a new person.",
    createdAt: "2026-10-09",
  },
  {
    id: "seed-ava",
    name: "Ava Rodriguez",
    service: "Balayage",
    rating: 5,
    text: "My balayage has never looked better. Sofia is a genius with colour.",
    createdAt: "2026-10-14",
  },
  {
    id: "seed-liam",
    name: "Liam O'Connor",
    service: "Beard trim",
    rating: 5,
    text: "Quick, precise beard trim with a proper hot towel finish. I'll be back every three weeks.",
    createdAt: "2026-10-19",
  },
  {
    id: "seed-sophia",
    name: "Sophia Kim",
    service: "Haircut",
    rating: 5,
    text: "They listened to what I wanted and the result is stunning. Booking my next visit already.",
    createdAt: "2026-10-24",
  },
  {
    id: "seed-mia",
    name: "Mia Johansson",
    service: "Full colour",
    rating: 5,
    text: "Friendly, unhurried, and my hair has never been easier to style at home.",
    createdAt: "2026-10-28",
  },
];

export type PublicReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  service: string | null;
  createdAt: string; // YYYY-MM-DD
  source: "seed" | "visitor";
};

export function seedPublicReviews(): PublicReview[] {
  return SEED_REVIEWS.map((s) => ({ ...s, source: "seed" as const }));
}

// Initials avatar: "Emma Thompson" -> "ET". Colours rotate through
// the five WCAG-verified dark hues already used for the stylists —
// white initials on each pass WCAG 2.1 AA (navy 11.50:1, dark red
// 10.02:1, dark teal 5.47:1, dark green 7.13:1, dark amber 7.09:1;
// see ACCESSIBILITY.md). No photos of real people: the reviewers
// are fictional / unknown, so initials are the honest face icon.
export const AVATAR_COLOURS = [
  "#1e3a5f", // dark navy
  "#7f1d1d", // dark red
  "#0f766e", // dark teal
  "#166534", // dark green
  "#92400e", // dark amber
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function avatarColour(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export function averageRating(reviews: PublicReview[]): {
  average: number;
  count: number;
} {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((total, r) => total + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

// Star glyphs for display: "★★★★★" / "★★★★☆". Always render with
// role="img" and an aria-label ("4 out of 5 stars") — a screen
// reader would otherwise read each star glyph out loud.
export function stars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

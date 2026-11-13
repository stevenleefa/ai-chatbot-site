// Demo offers for /deals — EDIT ONLY THIS FILE to change the
// offers shown on the deals page. These are placeholder offers
// for the demo salon, NOT real promotions: the discounts, prices
// and terms are invented for the sample site. A real client
// replaces them with their own current offers (and deletes any
// that do not apply).
export type Deal = {
  id: string;
  title: string;
  description: string;
  highlight: string; // short badge, e.g. "Save 20%"
  terms: string;
};

export const DEALS: Deal[] = [
  {
    id: "first-visit",
    title: "First visit — 20% off any haircut",
    description:
      "New to Lumen? Your first haircut is 20% off — wash and style included, as always.",
    highlight: "Save 20%",
    terms: "One per new client. Mention this offer when you book.",
  },
  {
    id: "colour-and-cut",
    title: "Colour & cut combo",
    description:
      "Full colour plus a haircut in one visit, from $95 — a $10 saving on booking them separately.",
    highlight: "From $95",
    terms: "Patch test 48 hours before your first colour appointment.",
  },
  {
    id: "weekday-colour",
    title: "Weekday colour — 15% off",
    description:
      "Book a colour appointment Tuesday to Thursday and take 15% off the colour service.",
    highlight: "Save 15%",
    terms: "Tuesday–Thursday only. Not combined with other offers.",
  },
  {
    id: "student",
    title: "Student discount — 10% off",
    description: "10% off any service with a valid student card.",
    highlight: "Save 10%",
    terms: "Show a valid student card at the studio.",
  },
];

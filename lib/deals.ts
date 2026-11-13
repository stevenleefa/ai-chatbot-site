// Demo offers for /deals — EDIT ONLY THIS FILE to change the
// offers shown on the deals page. These are placeholder offers
// for the demo salon, NOT real promotions: the discounts, prices
// and terms are invented for the sample site. A real client
// replaces them with their own current offers (and deletes any
// that do not apply).
//
// Each deal also has a coupon `code` (shown in the coupon dialog
// and encoded in the deal's QR code) and a coupon URL: scanning
// the QR opens /deals?coupon=<code>, which pops the coupon dialog
// for that deal (see components/DealsClient.tsx).
export type Deal = {
  id: string;
  title: string;
  description: string;
  highlight: string; // short badge, e.g. "Save 20%"
  terms: string;
  code: string; // coupon code, e.g. "LUMEN20" — shown in the coupon dialog
};

// The live site's address, used to build the coupon URLs the QR
// codes encode. A phone that scans a QR cannot reach localhost, so
// the QR always points at production — even when the page is viewed
// on a dev clone.
export const SITE_URL = "https://ai-chatbot-site-tawny.vercel.app";

// The URL a deal's QR code encodes: the production deals page with
// ?coupon=<code>, which opens that deal's coupon dialog.
export function couponUrl(deal: Deal): string {
  return `${SITE_URL}/deals?coupon=${deal.code}`;
}

// Looks a scanned (or typed) ?coupon= value up: case-insensitive,
// so LUMEN20 and lumen20 both work; unknown codes return
// undefined and the page simply shows the deals with no dialog.
export function findDealByCode(code: string): Deal | undefined {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return undefined;
  return DEALS.find((d) => d.code === wanted);
}

export const DEALS: Deal[] = [
  {
    id: "first-visit",
    title: "First visit — 20% off any haircut",
    description:
      "New to Lumen? Your first haircut is 20% off — wash and style included, as always.",
    highlight: "Save 20%",
    terms: "One per new client. Mention this offer when you book.",
    code: "LUMEN20",
  },
  {
    id: "colour-and-cut",
    title: "Colour & cut combo",
    description:
      "Full colour plus a haircut in one visit, from $95 — a $10 saving on booking them separately.",
    highlight: "From $95",
    terms: "Patch test 48 hours before your first colour appointment.",
    code: "COLOUR95",
  },
  {
    id: "weekday-colour",
    title: "Weekday colour — 15% off",
    description:
      "Book a colour appointment Tuesday to Thursday and take 15% off the colour service.",
    highlight: "Save 15%",
    terms: "Tuesday–Thursday only. Not combined with other offers.",
    code: "WEEKDAY15",
  },
  {
    id: "student",
    title: "Student discount — 10% off",
    description: "10% off any service with a valid student card.",
    highlight: "Save 10%",
    terms: "Show a valid student card at the studio.",
    code: "STUDENT10",
  },
];

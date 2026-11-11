import Stripe from "stripe";

// Server-only Stripe client. This file must only be imported from
// server code (API routes / server components) — never from a client
// component — because STRIPE_SECRET_KEY must never reach the browser.
// The site never sees a card number: checkout happens on Stripe's
// hosted page, which is the PCI-compliant way (see SHOP.md).
// Returns null when the key is missing, so the shop still lists
// products and the cart still works in demo mode; checkout just
// reports that it is not set up yet.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

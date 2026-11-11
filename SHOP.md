# Shop — Lumen Hair Studio

The public shop at **`/products`**: the studio's retail range, a
cart, and secure card payment through **Stripe Checkout** (hosted
redirect flow). Fulfilment is **in-store pickup** at 12 Maple Street
— no delivery, no shipping fees.

## Catalogue — `lib/products.ts`

`lib/products.ts` is the single source of truth for shop products.
Each product has an id (slug), name, description, price in cents
(+ a display price via `formatPrice`) and a category.

The 9 products the 12 fictional regulars already bought come from
the old `RETAIL_PRODUCTS` in `lib/customers.ts` — same names, same
prices (that list now imports from `lib/products.ts`, so there is
exactly one copy of each price):

| Product | Price |
|---|---|
| Shampoo (1L) | $24 |
| Conditioner (1L) | $22 |
| Colour-care shampoo | $28 |
| Colour-care mask | $32 |
| Hairspray | $18 |
| Styling gel | $16 |
| Leave-in treatment | $26 |
| Heat protect spray | $20 |
| Beard oil | $14 |

6 more products were added for the shop (not in any customer's
purchase history — they are new to the range):

| Product | Price |
|---|---|
| Styling cream | $19 |
| Dry shampoo | $17 |
| Hair oil | $25 |
| Scalp scrub | $21 |
| Colour care gift set | $56 |
| Everyday gift set | $44 |

There are no product photos — each card shows a styled tile with
the product's initials. Do not invent photos; if the studio wants
real photos later, add them as files and reference them from
`lib/products.ts`.

## Cart — `components/ShopClient.tsx`

Client component. Add to cart with a quantity picker (1–99), change
quantities with +/−, remove lines, running total. The cart is saved
in `localStorage` under the key `lumen-cart`, so it survives a
refresh; the success page clears it after a paid checkout.

## Checkout — Stripe Checkout (hosted)

**The site never sees card numbers.** The shopper is redirected to
Stripe's hosted checkout page, pays there, and is sent back to
`/products/success?session_id=…` (or `/products/cancelled` if they
back out — nothing is charged and the cart is still saved).

- `lib/stripe.ts` — server-only Stripe client from
  `STRIPE_SECRET_KEY`; `null` when unconfigured (same pattern as
  `lib/supabase.ts`). Never imported by a client component.
- `app/api/checkout/route.ts` — POST. Validates the cart server-side:
  product ids must exist in `lib/products.ts`, quantities must be
  integers 1–99, at most 20 lines, name ≤ 100 chars, email must match
  a basic email pattern. **Totals are computed server-side from
  `lib/products.ts` — client prices are never trusted.** Rate-limited
  per IP (10/min, 429 + Retry-After) like `/api/lead`; body capped at
  32 KB. Creates a Stripe Checkout Session (mode `payment`,
  success/cancel URLs back to the site) and returns the session URL;
  the client redirects to it. Returns 503 when Stripe is not
  configured. A pending order row is recorded for the owner list when
  Supabase is configured; if that insert fails the checkout still
  goes ahead (the payment is the priority — the failure is logged).
- `app/products/success/page.tsx` — takes `?session_id=`, retrieves
  the session **server-side with the secret key**, and marks the
  order paid only when Stripe says `payment_status === "paid"`. It
  never trusts a `?paid=true` query param. If the session cannot be
  looked up it says so plainly and points at the Stripe receipt /
  the studio phone number.
- `app/products/cancelled/page.tsx` — plain "checkout cancelled,
  your cart is still here" message.

## Orders — `supabase/orders-schema.sql`, `app/orders/page.tsx`

Run `supabase/orders-schema.sql` once in the Supabase SQL Editor of
the ai-leads project. `public.orders` (id, created_at, business
default 'salon', customer_name, customer_email, items jsonb,
total_cents, currency default 'usd', stripe_session_id unique,
status pending/paid/cancelled). RLS on with NO public policies
(service-role only, like leads).

`/orders` is an owner page (middleware-guarded, session-checked,
like `/leads`): newest first, status badge, customer, items, total.
It is in the fixed top nav (OwnerNav) for every signed-in staff
member, and `loading.tsx` shows "Loading orders…" while it renders.

## Stripe setup (what the owner must do)

1. Create a Stripe account at dashboard.stripe.com (free).
2. In the Stripe dashboard, switch to **Test mode** and copy the
   **test secret key** (`sk_test_…`) from Developers → API keys.
3. In the salon project's `.env.local`, add
   `STRIPE_SECRET_KEY=sk_test_…` (never paste the key in chat, never
   commit `.env.local`), then restart the dev server.
4. Test the shop: add products, check out, pay with the test card
   **4242 4242 4242 4242**, any future expiry, any CVC, any postcode.
   The success page should say "Thank you — order confirmed" and
   `/orders` should show the order as Paid.
5. Also run `supabase/orders-schema.sql` once so orders are recorded
   (the checkout still works without it, but `/orders` stays empty).

## Going live with real money

Only when the owner explicitly chooses it: in the Stripe dashboard
switch to **Live mode**, copy the **live secret key** (`sk_live_…`)
and replace `STRIPE_SECRET_KEY` with it (in `.env.local` for local
testing, and in Vercel env vars for the live site). Test with a real
card only for a real order — live test cards do not work. Never put
a live key in for this fictional demo without the owner's explicit
go-ahead.

## What this does not do

- No delivery or shipping — pickup only.
- No refunds or order editing in the site — handle those in the
  Stripe dashboard.
- No customer accounts (deferred by the owner) — checkout collects
  name + email for the pickup order only.
- The seed reviews in the pop-ups and the Reviews section are demo
  data for the fictional regulars (see REVIEWS.md) — the owner
  replaces them with real reviews.

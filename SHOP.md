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

## Products in Supabase

Run `supabase/products-schema.sql` once in the Supabase SQL Editor
of the ai-leads project. `public.products` (id, name, description,
price_cents, category, image, in_stock, featured, active, sale_type
/ sale_percent / sale_buy / sale_get, created_at, updated_at). RLS
on with NO public policies (service-role only, like orders). The
seed carries the same 15 products as `lib/products.ts`, with the
starting states: Scalp scrub + Hair oil out of stock, Colour-care
mask the one featured product, Colour-care shampoo 15% off,
Shampoo (1L) buy 2 get 1 free. A partial unique index enforces at
most one featured product — the admin action that features a
product must un-feature the old one first.

`lib/products-db.ts` (`getCatalogue()`, `getProductById()`) reads
this table when Supabase is configured and falls back to the static
`PRODUCTS` list otherwise, so the shop never breaks for a database
problem. Sale pricing lives in the pure helpers in
`lib/products.ts` (`getSalePriceCents`, `getLineTotalCents`,
`getDiscountLabel`) — the client cart and the server checkout both
call them, so the displayed price and the charged price cannot
disagree. The shop shows only `active` products; removing one sets
`active = false` (the row stays, because orders reference product
ids).

## Admin products page — `/admin/products`

The owner manages the catalogue from **`/admin/products`** (admin
role only, same gating as `/admin` — middleware plus the page's own
session check; linked from the Admin page as "Manage products →").
It lists the **full** catalogue — all 15 products, including removed
ones, which carry a "Removed from shop" badge so the admin can
re-activate them. Per product there is an edit form (name, price in
dollars, description, category, image URL, stock status, sale offer)
and, in the row's Actions column, a **Remove from shop** /
**Re-activate** button. Below the table, an **Add a new product**
form (same fields) adds a replacement.

- **Fields.** Name 1–100 chars, price a number of dollars 0 or
  more (stored as integer cents — $24.99 becomes 2499), description
  at most 500 chars, category 1–100 chars, image URL empty or
  `https://` (Unsplash photos; anything else is rejected), stock
  in/out of stock, sale none / percent off 1–99% / buy X get Y free
  (buy/get whole numbers 1–99). The rules live in the pure helpers
  in `lib/product-validation.ts` (unit-tested in
  `__tests__/admin-products.test.ts`) and are enforced by the server
  actions in `app/admin/products/actions.ts`, which re-check the
  admin role and refuse in demo mode first.
- **One featured product.** Only one product may be featured at a
  time. The page shows which one is featured (a "Featured" badge,
  and "Featured product: …" above the table) and each other active
  product has a **Make featured** button. The `setFeaturedProduct`
  action un-features the current featured product FIRST, then
  features the chosen one — the partial unique index on
  `products (featured) WHERE featured = true` would reject a naive
  update. A removed product cannot be featured (re-activate it
  first).
- **Remove means hide, never delete.** Removing sets
  `active = false`; the row stays because past orders reference
  product ids, and the product can be re-activated from the same
  row. Removing also clears its featured flag, so a hidden product
  cannot hold the shop's one featured slot. Adding a product makes
  its id from the name — a URL-safe slug (lowercase, spaces become
  hyphens, other characters stripped) — and rejects the name if that
  id already exists, so the admin cannot create a duplicate by
  retyping a name with different capitalisation.
- **Demo mode.** In Test Admin Mode the page shows the static
  catalogue with its starting states and every control is disabled,
  each wrapped in the "For demo purposes only" popover
  (`DemoPopover`), with the `DemoBanner` at the top; the server
  actions refuse with `assertNotDemo()` before any Supabase call.
- **Setup (user step).** Run `supabase/products-schema.sql` **once**
  in the Supabase SQL Editor of the ai-leads project — it creates
  the `products` table (RLS on, no public policies, service-role
  only) with the same 15 products and starting states as
  `lib/products.ts`. Until Supabase is configured the page still
  lists the static catalogue but shows a "Product storage is not
  configured" notice and all controls are disabled; edits need the
  table and the service-role key.

## Out of stock, featured & sales

**Starting states** (in the static list and in the Supabase seed):
Scalp scrub and Hair oil are out of stock; Colour-care mask is the
one featured product; Colour-care shampoo is 15% off; Shampoo (1L)
is buy 2 get 1 free; every product starts active.

- **Out of stock** — the product is still listed, with an "Out of
  stock" badge and a plain-text reason, but its quantity picker and
  Add-to-cart button are real `disabled` controls. On cart load the
  shop drops saved lines for products that are now out of stock or
  removed (same cleanup as for unknown ids). The checkout route
  rejects an out-of-stock line with 400 (`"<name> is out of
  stock."`) and a removed (inactive) line with 400 (`"<name> is no
  longer available."`) — a stale or hand-built cart cannot buy
  something the studio cannot sell.
- **Featured** — the one featured product gets a "Featured" section
  at the top of the shop (an `<h2>` heading + a larger card with
  its photo, name, description, price and its own Add-to-cart +
  quantity picker), plus a "Featured" badge on its card in the
  grid. If nothing is featured, no section is rendered. The admin
  action that features a product un-features the old one first (a
  partial unique index in the database enforces at most one).
- **Sales** — the price a shopper sees and the price Stripe charges
  come from the same helpers (`getSalePriceCents`,
  `getLineTotalCents`, `getDiscountLabel` in `lib/products.ts`).
  A percent-off product shows the sale price next to the
  struck-through original price (Colour-care shampoo: $23.80,
  ~~$28.00~~, "15% off"). A buyXGetY product shows the full unit
  price plus the offer text; the cart line shows the offer and how
  many units are free ("Buy 2 get 1 free — 1 free") and the
  discounted line total. The cart total uses `getLineTotalCents`
  for every line. The sale is always text (struck-through price +
  offer), never colour alone.
- **The sale ribbon** — a diagonal red bar across the bottom-left
  corner of the product photo tile (`.sale-ribbon` in
  `app/globals.css`): a 200px strip centred on the tile's
  bottom-left corner, rotated 45°, clipped by the tile so only the
  diagonal band shows, with the offer text in white bold on
  `#b91c1c` (white on #b91c1c is 6.47:1, WCAG 2.1 AA in both light
  and dark mode — the red is fixed, not a theme variable). It sits
  on the tile only, never over the name or price, and is
  `aria-hidden` (decorative): the offer is also plain text next to
  the price, so screen readers hear it once.
- **What Stripe is charged** — the checkout route re-prices every
  line server-side and never trusts client prices. Percent-off:
  `unit_amount` is the sale unit price, quantity is the quantity
  ordered. BuyXGetY: `quantity` is the *paid* quantity only (qty 3
  → 2, qty 4 → 3, qty 6 → 4), `unit_amount` is the full price, and
  the free units are noted in the line item's description
  ("Buy 2 get 1 free — 1 free"). The recorded pending order uses
  the same discounted unit price / paid quantity, so its
  `total_cents` matches the Stripe total exactly.

## Cart — `components/ShopClient.tsx`

Client component. Add to cart with a quantity picker (1–99), change
quantities with +/−, remove lines, running total. The cart is saved
in `localStorage` under the key `lumen-cart`, so it survives a
refresh; the success page clears it after a paid checkout.

**Save cart.** Below the checkout button, a "Save this cart as"
name input (default "Saved cart") + "Save cart" button. Signed in
with Supabase configured, it POSTs to `/api/saved-carts` and the
cart can be restored from `/my-account`. Otherwise (signed out,
or Supabase unconfigured) it saves on this device only, under
the separate key `lumen-saved-carts`, and the confirmation says
so — a local save is never mistaken for an account save. Saving
never changes the live cart. See CUSTOMER_ACCOUNTS.md for the
restore rule (restore replaces, with a confirm when the current
cart is non-empty).

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

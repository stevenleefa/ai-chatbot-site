# Security — Lumen Hair Studio demo site

What this document is: the threat model for this demo site, what was
audited and fixed on 2026-11-10, the pen-test that was actually run
(and its real results), and the risks that remain. It is not a claim
that the site is "fully secure" — read the residual risks at the end.

## Threat model

This is a small-business demo site, not a bank. What it holds:

- Public: business details, prices, hours, a chatbot that answers
  only from the business's own data, and a public booking form.
- Owner-only: the leads list (customer names, contact details,
  messages), the business dashboard (sales, payroll, taxes), customer
  and employee records, and the admin page (user management, site
  settings, staff invites).
- Secrets: the Supabase service-role key (bypasses Row Level
  Security) and the OpenAI key (optional). Both are server-only.

What it protects against: unauthenticated people reading owner data,
visitors injecting scripts or SQL through the forms, open redirects
that send a signed-in owner to an attacker's site, floods of fake
bookings, and leaked secrets. What it does NOT try to be: a hardened
production system with a WAF, a distributed rate limiter, or a
content-security policy (see residual risks).

## What was audited (2026-11-10)

Read end to end: `middleware.ts`, every API route
(`app/api/lead`, `app/api/leads/*`, `app/api/chat`), `lib/auth/*`,
`lib/supabase.ts`, `lib/leads.ts`, `supabase/schema.sql` +
`supabase/auth-schema.sql` (RLS policies), `next.config.js`,
`package.json`, and a grep for `dangerouslySetInnerHTML` and for
places user input is rendered or redirected.

### Findings and fixes

1. **Open redirect via `?next=` — FOUND AND FIXED (the serious one).**
   `app/auth/callback/route.ts` passed `?next=` straight to
   `new URL(next, ...)`, so `/auth/callback?next=https://evil.example`
   (after a real sign-in) redirected the owner off-site. `/login`
   had the same hole via `router.push(next)`. Both now go through
   `safeRedirect()` in `lib/security.ts`, which only allows
   same-origin paths (must start with `/`, never `//`, never
   `/\`, never an absolute URL, and URL-encoded tricks are decoded
   first). Anything else falls back to `/dashboard`.
2. **No input validation on the public booking form — FIXED.**
   `/api/lead` accepted any JSON of any size. It now rejects bodies
   over 32 KB (413), requires string fields, and caps them (name /
   contact / service 100 chars, message 2,000 chars) with a 400 on
   anything else. The cap is enforced by `readCappedJson()` in
   `lib/security.ts`, which reads the raw body and measures its bytes
   — so it also covers chunked requests, which carry no
   content-length header for a header-only check to see. `/api/chat`
   caps the question at 1,000 chars and `/api/leads/status` now checks
   the id is a string under 100 chars.
3. **No rate limiting — ADDED (per instance).** `lib/security.ts`
   has a fixed-window in-memory limiter: `/api/lead` 10 requests/min
   per IP, `/api/chat` 30/min per IP, with a 429 + `Retry-After`
   header. It is per server instance (see residual risks).
4. **No security headers — ADDED.** `next.config.js` now sends on
   every route: `Strict-Transport-Security` (2 years, include
   subdomains, preload), `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: DENY`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Permissions-Policy:
   camera=(), microphone=(), geolocation=()`. No
   Content-Security-Policy: Next.js App Router ships inline scripts
   for hydration, so a strict CSP breaks the site unless every
   script carries a nonce plumbed through middleware and the build —
   that work was not done, so shipping a CSP would have meant
   shipping a broken one (or a useless `unsafe-inline` one). A real
   production deployment should add a nonce-based CSP.
5. **CSV formula injection in the leads export — FIXED.** The
   owner downloads leads as a CSV and opens it in a spreadsheet. A
   lead name starting with `=`, `+`, `-`, `@`, tab or carriage
   return (e.g. `=cmd|...`) could run as a formula. `csvEscape()` in
   `lib/leads.ts` now prefixes such fields with a single quote, the
   standard mitigation.
6. **Personal data in server logs — FIXED.** The unconfigured
   `/api/lead` branch logged the visitor's name, contact, service
   and message to the server log. It now logs only that a lead
   arrived unsaved.
7. **Invite link built from the Host header — HARDENED.**
   `inviteUser` built the invite `redirectTo` from the request's
   `host` header. Sending an invite already requires an admin
   session and browsers set Host honestly, so this was never
   exploitable on its own — but it is now defence in depth: when
   `NEXT_PUBLIC_SITE_URL` is set (production; added to
   `.env.example`) it is used instead, and the Host header is only
   the dev fallback.
8. **XSS — checked, nothing to fix.** No `dangerouslySetInnerHTML`
   anywhere in the app. React escapes by default: the chat widget
   renders user messages as `{m.text}`, the leads table renders lead
   fields as text. User input is never rendered as HTML.
9. **Chat prompt injection — checked, low risk.** In free mode
   (no OpenAI key, the mode this site runs in) there is no LLM at
   all: the answer IS the retrieved business chunk, so a crafted
   question cannot make the site say anything that is not already in
   `lib/business.ts`. With a key set, the LLM gets a fixed system
   prompt ("answer only from the business context… never invent")
   and only the retrieved chunks as context, at temperature 0.
   There is no other business's data in this deployment to leak.
10. **Supabase RLS — checked, sound.** `leads` has RLS on with NO
    public policies (only the service-role key touches it, and the
    server routes filter by `business = 'salon'`); the auth schema
    adds staff SELECT/UPDATE on salon leads only, no INSERT policy.
    `profiles`: users read their own row, admins read/update all,
    rows are created only by the signup trigger (invited users
    become `staff`, public sign-ups become `customer` — see
    CUSTOMER_ACCOUNTS.md; a customer profile can never open an
    owner page, the middleware and the pages both check the role).
    `site_settings`: staff read, admins update. The service-role
    key is imported only from server code (`app/leads/page.tsx`,
    `app/admin/page.tsx`, API routes, server actions) — never from a
    client component.
11. **Secrets — checked, clean.** No secret value is committed
    (grep for key patterns found nothing). `.env.local` is
    gitignored. The service-role key and the OpenAI key appear
    nowhere in code or docs except as empty placeholders in
    `.env.example`.
12. **Middleware guard — checked, works as designed.** It guards
    `/leads`, `/dashboard`, `/admin`, `/customers`,
    `/appointments`, `/employees` and `/api/leads/*`: pages 307 to
    `/login`, APIs 401, and a session alone is not enough — the
    caller also needs an active `profiles` row. When Supabase is
    not configured (this workspace), the middleware passes requests
    through by design and the pages show their "Auth is not
    configured" notice instead of data; the API routes still return
    401 without a session. That demo-mode passthrough is
    intentional — see residual risks.

## Pen-test (2026-11-10, local dev server only)

Run with `scripts/pentest.mjs` against a local dev server started
with dummy Supabase vars (guard ON, no real project):
`NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run dev -- -p 3100`.
Never run against the live Vercel site. Result: **19/19 probes
passed.**

| Probe | What was tried | What actually happened |
|---|---|---|
| Unauth GET /leads, /dashboard, /admin, /customers, /employees, /appointments | No session cookie | 307 to `/login?next=<page>` on all six |
| Unauth GET /api/leads, /api/leads/export | No session cookie | 401 on both |
| XSS in /api/lead message | `message: "<script>alert(1)</script>"` | 200, payload not in the response body |
| SQLi in /api/lead name | `name: "' OR '1'='1"` | 200, no error, no SQL/Supabase text leaked |
| Open redirect /auth/callback | `?next=https://evil.example`, `?next=//evil.example`, `?next=/%2Fevil.example` (no code) | 307 to `http://localhost:3100/login` — never evil.example |
| Oversized POST /api/lead | 100,000-char message | 413 |
| Wrong method | GET /api/lead | 405 |
| Forged session cookie | Fake `sb-dummy-auth-token` cookie on /api/leads | 401 |
| Rate limit /api/lead | 15 rapid POSTs from one test IP | 10 allowed, 5 × 429 |
| Security headers | GET / | All five headers present with the values in next.config.js |
| safeRedirect unit checks | 8 cases (good paths, absolute URL, `//`, encoded `//`, backslash, empty, null) | All 8 as expected |

Notes on what the probes did NOT cover: the open-redirect success
path (a valid Supabase `?code=` plus an evil `?next=`) could not be
exercised — there is no real Supabase project in this workspace, so
no valid code exists here; the fix is covered by the `safeRedirect`
unit checks instead. The `/api/lead` probes ran against the
unconfigured branch (no service-role key in the workspace), so they
prove validation, rate limiting and non-reflection, not the database
insert. No real browser exploitation was attempted, no
authenticated-user attack was simulated (no staff account trying to
reach admin routes), and nothing was tested against the live site.

## npm audit

`npm audit` could NOT be run here: the workspace registry proxy
returns `403 Forbidden - policy_denied` for the audit endpoint, so
no audit result exists from this machine. The dependencies are
`next 14.2.33`, `react 18.3.1`, `@supabase/ssr 0.12.7`,
`@supabase/supabase-js 2.119.0`. Run `npm audit` on a machine with
normal registry access (the owner's Mac) before the next deploy, and
record the result here.

## Residual risks (stated plainly)

- **Rate limiting is per instance.** Vercel may run several
  instances; a flood spread across them is not capped globally. A
  real deployment wants a shared store (e.g. Upstash Redis) or a
  WAF in front.
- **No Content-Security-Policy.** Deliberately deferred (see fix
  4). The site relies on React's escaping and the other headers
  instead. Add a nonce-based CSP before handling real customer data
  at scale.
- **No WAF, no bot protection.** The public booking form and chat
  are open to anyone; the rate limit is the only flood control.
- **Demo-mode passthrough.** When Supabase is not configured, the
  middleware lets requests through and the owner pages show a
  notice instead of data. That is by design for local development,
  but it means a deployed site with missing env vars shows notices
  rather than a hard failure — check the env vars are set after
  every deploy.
- **Free-tier Supabase.** A free project pauses after a week of
  inactivity and has the limits of the free tier; the legacy
  service-role key is due to retire in early 2027 (see the
  Supabase notes in MEMORY.md).
- **Invite emails go through the project's SMTP.** If the SMTP
  account is compromised, an attacker could send invites — that is
  a Supabase-account risk, not a site-code one.
- **This pen-test was local-only.** It proves the guards behave
  against the probes above on a dev server. It is not a
  certification, and it does not cover the live deployment, the
  real Supabase project, or authenticated-user attacks.

## Shop + reviews (2026-11-11)

- **Stripe secret key is server-only.** `STRIPE_SECRET_KEY` is read
  only by `lib/stripe.ts` (server code, same pattern as
  `lib/supabase.ts`); no client component imports it, and it never
  appears in logs, code or Supabase. Card data never touches the
  site at all — Stripe's hosted Checkout page takes the card.
- **Checkout validation.** `POST /api/checkout` re-prices every line
  server-side from `lib/products.ts` and rejects unknown product
  ids, non-integer or out-of-range quantities (1–99), more than 20
  lines, and bad name/email with 400. Client prices are never
  trusted. Rate-limited per IP (10/min, 429 + Retry-After) and body
  capped at 32 KB, like `/api/lead`. Stripe errors are logged
  server-side only; the client gets a generic message.
- **Success page verification.** `/products/success` retrieves the
  Checkout Session server-side with the secret key and marks the
  order paid only when Stripe says `payment_status === "paid"`. It
  never trusts a `?paid=true` query param.
- **Orders / reviews tables.** `supabase/orders-schema.sql` and
  `supabase/reviews-schema.sql` follow the leads pattern: RLS on,
  NO public policies — only the service-role client in API routes
  and server pages can touch them. The public reviews GET returns
  approved reviews only; visitor reviews are saved as `pending`
  and need an admin approve on `/admin` (server actions re-check
  the caller is an active admin).
- **Review validation.** `POST /api/reviews` checks name 1–100
  chars, rating integer 1–5, text 1–1,000 chars, and rejects any
  text containing `http://` or `https://` (simple spam control);
  rate-limited per IP (10/min) and body capped at 32 KB.
- **Test mode by default.** The key in `.env.example` is documented
  as a Stripe test key first (test card 4242 4242 4242 4242); a live
  key goes in only if the owner explicitly chooses real money.

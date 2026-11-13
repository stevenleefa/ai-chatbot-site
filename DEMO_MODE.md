# Test Admin Mode (demo mode)

A recruiter clicks **Test Admin Mode** in the hamburger menu (under the
sign-in rows) and browses the whole owner area — Dashboard, Leads,
Customers, Appointments, Employees, Orders, Admin, Profile — with
**sample data only**. No real customer data is ever shown, and nothing
the visitor does can change anything. Exit from the hamburger menu
("Exit Test Admin Mode") or the link on any owner page's demo notice.

## How it works

- **The flag is a cookie.** `GET /api/demo?on=1` sets `lumen-demo=1`
  (httpOnly, SameSite lax, path `/`, 7 days) and redirects to
  `/dashboard`. `GET /api/demo?on=0` clears it (Max-Age 0) and
  redirects to `/`. The route is in `app/api/demo/route.ts`; the
  constants live in `lib/auth/demo-cookie.ts`.
- **The middleware recognises it.** `middleware.ts` reads the cookie and
  passes `demo` into `decideOwnerAccess()` (`lib/auth/guard.ts`), which
  allows owner routes for a signed-out visitor with the cookie.
- **The invariant.** Demo mode is only ever on for a signed-OUT visitor
  with the cookie (`isDemoMode(cookieValue, session)` in
  `lib/auth/demo-cookie.ts`). A signed-in user — staff, admin or
  customer — is always judged by their real role, so the cookie can
  never upgrade a customer or downgrade staff. A visitor setting the
  cookie by hand only ever gets the demo, because every owner page
  serves sample data when demo mode is on and never reads the real
  Supabase tables. The owner pages call `getDemoOrSession()`
  (`lib/auth/demo.ts`), which returns `{ demo, session }` in one call.
- **Sample data** lives in `lib/demo-data.ts` (pure data, no Supabase):
  - `/leads` — 9 sample leads derived from the fictional regulars in
    `lib/customers.ts` (8 unique contacts + Emma Thompson twice, so her
    repeat count shows as 2). Every contact is an `@example.com`
    address; every service is one the salon actually offers.
  - `/orders` — 4 sample orders from the fictional regulars, priced
    from the shop catalogue (`lib/products.ts`), so totals always tie
    out. `stripe_session_id` is null — these were never a real checkout.
  - `/admin` Users — Maya Chen (admin), Sofia Reyes and Amelia Brooks
    (staff), Emma Thompson (customer), on fictional
    `@lumenhairstudio.example` / `@example.com` addresses.
  - `/admin` Review approvals — the first 3 seed reviews from
    `lib/reviews.ts`, shown as pending.
  - The dashboard, customers, appointments and employees pages already
    use sample data (`lib/dashboard.ts`, `lib/customers.ts`,
    `lib/employees.ts`) — in demo mode they only gain the demo banner.
    `/admin` shows the settings form filled from the static business
    values (`defaultSettings()` in `lib/site-settings.ts`), never the
    real `site_settings` row.
- **The notice.** Every owner page shows a `DemoBanner`
  (`components/DemoBanner.tsx`, reusing the existing `.demo-banner`
  style): "Test Admin Mode — sample data… Nothing you do here changes
  anything", with an "Exit Test Admin Mode" link.
- **Mutations are blocked twice.** On the page, the controls are
  disabled or replaced in demo mode: the leads status select
  (`components/LeadsTable.tsx`, `demo` prop), the role/active buttons,
  the settings inputs and save button, and the review Approve/Delete
  buttons on `/admin`, and the invite form is replaced with a demo
  note. On the server, the backstop runs first: every admin action in
  `app/admin/actions.ts` starts with `assertNotDemo()` (throws "Demo
  mode — this doesn't change anything."), except `inviteUser`, which
  returns `{ ok: false, message: "Demo mode — inviting staff is
  disabled. Nothing was sent." }` so the form shows it inline. And
  `POST /api/leads/status` returns 403 "Demo mode — status changes are
  disabled." in demo mode. `GET /api/leads` returns the sample leads
  with `demo: true`; `GET /api/leads/export` returns a CSV of them.
  A real admin who happens to have the demo cookie set is NOT blocked:
  they have a session, so demo mode is off for them.
- **The popover.** Every disabled control in demo mode, and the "Test
  Admin Mode" menu entry itself, carries a popover
  (`components/DemoPopover.tsx`, styles in `app/globals.css`):
  hovering it — or tabbing to it — shows a small floating note,
  **"For demo purposes only"** / "Nothing changes in demo mode."
  A disabled element cannot take focus or fire pointer events, so
  the popover's wrapper is what receives hover/focus (it is the tab
  stop, with the site's usual focus ring) and it carries the
  description (`aria-describedby`, `role="tooltip"`) so a screen
  reader announces it. The menu entry is a working link, so the link
  itself is the tab stop and carries the description instead. The
  popover is `position: fixed` with coordinates measured from its
  control, so it is never clipped by a scrolling table container;
  it sits above its control (below it when there is no room above)
  and follows it on scroll/resize, hides on Escape, and appears
  instantly (no fade) under `prefers-reduced-motion`. It only ever
  exists in demo mode: the pages pass `demo` as `enabled`, so a
  signed-in admin's buttons render exactly as before, with no
  popover at all.
  - The menu entry (hover or Tab to it in the hamburger menu).
  - `/leads` — every status select (9 in demo).
  - `/admin` — the role and active buttons on every user row, the
    review Approve/Delete buttons, the whole settings form (one
    popover for the form: every input and the save button are
    disabled), and the invite note that replaces the invite form.
  - The dashboard, customers, appointments, employees and profile
    pages have no disabled controls in demo mode — they only gain
    the banner, so there is nothing to put a popover on there.
  - The demo banner itself has no popover: it already says the same
    thing in full ("Test Admin Mode — sample data… Nothing you do
    here changes anything"), so a popover on it would only repeat
    it.
- **The menu** (`components/HamburgerMenu.tsx`, `demo` prop from
  `components/SiteNav.tsx`, which reads `getDemoOrSession()`): signed
  out, "Test Admin Mode" sits under "Sign in" / "Customer sign in"
  with the sub-line "Sample data — for recruiters". While demo mode is
  on, the menu shows a "Test Admin Mode" identity block (avatar "TA",
  "Sample data — no real account", role "Demo"), an "Exit Test Admin
  Mode" row, the sign-in rows, and the full Owner section including
  Admin. Signed-in users never see the demo entry — for them the flag
  is inert.

## What demo mode deliberately does NOT block

The public booking form, the shop checkout and the chatbot booking are
public features, not owner features — they work exactly as before in
demo mode (a recruiter can also try booking as a visitor). Only the
owner area is demo-gated.

## How to test (on the clone)

No Supabase is needed — demo mode works whether or not auth is
configured (the pages check demo before the auth-configured check).

1. `git pull && npm install && npm run dev` (no new dependencies).
2. Open the site signed out. Hamburger menu → **Test Admin Mode**.
   You land on /dashboard with the "Test Admin Mode — sample data"
   banner. Browse Leads (9 sample leads, Emma Thompson twice),
   Orders (4 sample orders), Admin (4 sample users, 3 pending
   reviews), Customers, Appointments, Employees, Profile (a "Demo
   Admin" card).
3. Try to change something: the leads status select is disabled; on
   /admin every button is disabled and the invite form is replaced by
   a note. (For the server backstop: with the demo cookie set, a POST
   to /api/leads/status returns 403.)
4. Hover any disabled control — a leads status select, an /admin
   role/active button, a review Approve/Delete button, the settings
   form, the invite note — and a small "For demo purposes only /
   Nothing changes in demo mode." popover appears above it. Tab to
   one instead: the popover appears on focus too, and Escape hides
   it. Hover or Tab to the "Test Admin Mode" entry in the hamburger
   menu (signed out, demo off) and the same popover appears there.
   Sign in as the owner and confirm no popover appears anywhere —
   the buttons work and carry no tooltip.
4. Hamburger menu → **Exit Test Admin Mode**. You land on the homepage
   and the owner pages ask for sign-in again.
5. Sign in as a customer, then set the demo cookie by hand (or visit
   /api/demo?on=1 while signed in): you are still sent to /my-account
   from every owner page — the cookie never upgrades a customer.
6. Sign in as the owner: the menu shows the normal owner menu, no
   "Test Admin Mode" entry, and the demo cookie (if still set) changes
   nothing.

## Tests

- `__tests__/demo.test.tsx` — the cookie helpers and `isDemoMode`,
  the sample-data invariants (fictional addresses only, order totals
  from the catalogue, lead repeat counts, real services/products),
  the leads table select disabled in demo mode, and the menu's demo
  entry / exit / inert-for-signed-in behaviour. Plus the popover:
  `DemoPopover` shows "For demo purposes only" / "Nothing changes
  in demo mode." on hover and on focus, hides on mouse-leave, blur
  and Escape, links itself with `aria-describedby` / `role="tooltip"`,
  and renders nothing at all when `enabled={false}`; the leads
  select and the menu entry show it in demo mode, and no tooltip
  exists outside demo mode or for a signed-in user.
- `__tests__/guard.test.ts` — demo cases for `decideOwnerAccess`:
  demo allows owner pages/API for signed-out visitors, a customer is
  still redirected even with the demo flag, staff/admin unchanged.

## What is NOT tested here

The server helpers (`lib/auth/demo.ts`) and the route handlers need a
live Supabase session and real cookies, so they are verified by the
manual checks above and by the live curl checks run during the build
(demo cookie → /dashboard 200 with the banner, /api/leads returns
`demo: true` with 9 sample leads, POST /api/leads/status → 403,
no-cookie /api/leads → 401).

# Customer accounts — Lumen Hair Studio

Customers can create an account of their own, sign in, and see their
own bookings and orders. Staff still join by admin invite only — the
customer sign-up is the one public signup on the site, and it can
never create a staff or admin account.

(This is different from the owner customers area in CUSTOMERS.md —
the `/customers` list of 12 fictional regulars and the November
appointments diary, which are demo data for the owner. This file is
about real customer accounts that sign in.)

## The role trap (read this first)

The original auth design had two roles (`admin`, `staff`) and a
trigger that made every new profile `staff`. A plain customer sign-up
on top of that would have handed every new customer a staff profile —
able to open `/leads`, `/dashboard` and `/admin` — and undone the
invite-only owner setup. So customer accounts are built around a
role fix, not just a sign-up page:

- **Database (`supabase/customer-accounts.sql`)** — the profiles role
  check now allows `('admin', 'staff', 'customer')`, and the
  `handle_new_user()` trigger gives `staff` only to invited users
  (`invited_at` is set by `inviteUserByEmail`, which is how staff
  join). Everyone else — a public sign-up, or a user added in the
  Supabase dashboard — becomes `customer`. Admin is never granted by
  the trigger. `supabase/auth-schema.sql` carries the same trigger
  and check now, so a fresh setup gets it from the start; projects
  that already ran the old file run `customer-accounts.sql` once.
- **The browser never chooses the role.** Sign-up calls
  `supabase.auth.signUp()` with only an email, a password and an
  optional name (stored as `user_metadata.full_name`). The profile
  row is created by the trigger. There is no client INSERT policy on
  `profiles` and no way for a visitor to claim `staff` or `admin`.
- **`is_active_staff()` / `is_admin()` already exclude customers.**
  The RLS helpers check `role in ('admin', 'staff')` / `role =
  'admin'`, so the leads policies that use them never let a customer
  read or update salon leads through their own session. No RLS
  change was needed: the customer area reads through the service-role
  client server-side (below), the same as `/orders`.

## Routes

| Route | What it is |
|---|---|
| `/my-account` | The customer area: profile, my bookings, my orders. Any signed-in account with an active profile can open it (a staff member who lands there sees only their own data, matched by their email). Signed-out visitors are redirected to `/my-account/sign-in?next=/my-account` by the page itself. |
| `/my-account/sign-up` | Public customer sign-up (email + password, optional name). Sends a Supabase confirmation email; the link goes to `/auth/callback?next=/my-account`. If email confirmation is switched off in Supabase Auth settings, sign-up signs the customer straight in instead. |
| `/my-account/sign-in` | Customer sign-in. Lands on `?next=` or `/my-account` — never `/dashboard`. |
| `/login` | Owner sign-in (unchanged). It now links to the customer pages: "Are you a customer? Create an account or sign in". |

`/customers` (the owner customer list) and `/profile` (the staff
profile page) are NOT reused for customers — a customer hitting
either is redirected to `/my-account`.

## Gating — customers never reach owner pages

- **Middleware (`middleware.ts`)** — the primary guard. It now reads
  the profile's `role` as well as `is_active` and decides through
  the pure function `decideOwnerAccess()` in `lib/auth/guard.ts`
  (unit-tested in `__tests__/guard.test.ts`). A customer asking for
  any owner route (`/leads`, `/dashboard`, `/admin`, `/customers`,
  `/appointments`, `/employees`, `/orders`, `/profile`, `/api/leads/*`)
  is redirected to `/my-account` (pages) or gets a 401 (API routes).
  `/my-account/*` is not an owner prefix, so customers can reach it.
- **Defence in depth** — every owner page (`/leads`, `/dashboard`,
  `/customers`, `/appointments`, `/employees`, `/customers/[id]`,
  `/employees/[id]`, `/orders`, `/profile`) and every `/api/leads/*`
  route repeats the customer check after its session check, so a
  request that somehow gets past the middleware is still stopped.
  `/admin` already showed "Admins only" to non-admins, which is safe
  for customers too. `lib/auth/session.ts` gained `requireStaff()`,
  and `requireRole("staff")` now really requires staff/admin — before
  this change it returned the session for any role, including a
  customer.
- **Owner server actions** (`app/admin/actions.ts`) all re-check
  `requireRole("admin")`, so a customer session cannot invite staff,
  change roles, deactivate users, save settings, or approve/delete
  reviews. `setUserRole` now also accepts `customer` as a target, so
  an admin can promote a customer to staff (the "Make staff" button
  on `/admin`) or demote a staff member to a customer account.

## What a customer sees

- **My account** (`app/my-account/page.tsx`) — their name (from
  `user_metadata.full_name` when set at sign-up, else derived from
  their email), email, account type, a change-password link and a
  sign-out button; then **My bookings** and **My orders**.
- **My bookings** — leads from the `leads` table for this business
  whose `contact` field is the customer's email
  (`lib/customer-account.ts` `getCustomerBookings()`). **Known limit:
  the booking form's contact field holds "phone or email" with no
  separate email column, so a booking only appears here if the
  customer typed their email when booking — a booking made with a
  phone number instead cannot be matched to the account and does not
  appear.** The page says so, so a missing booking is explained
  rather than a mystery.
- **My orders** — orders from the `orders` table whose
  `customer_email` is the customer's email
  (`getCustomerOrders()`). Orders carry a clean email column, so
  every shop order placed with the account email appears.
- Both lists are matched by the email from the **verified session**,
  case-insensitively (`.ilike`, with `%`/`_` escaped so they cannot
  widen the match), and filtered to this business (`business =
  'salon'` — the tables are shared with the plumbing demo). A
  customer only ever sees their own rows. The queries run
  server-side with the service-role client, the same pattern as
  `/orders`.
- **Header menu** — a signed-in customer sees their initials/name/
  email with the role label "Customer", a "My account" row and "Log
  out". No "Profile", no "Switch user", and no owner section
  (Dashboard, Leads, Customers, Appointments, Employees, Orders,
  Admin). Signed out, the menu shows "Sign in" (owner) and
  "Customer sign in". The log-out dialog for a customer says they
  will need to sign in again to see their bookings and orders
  (not "the owner area").

## Files

| File | What it does |
|---|---|
| `supabase/customer-accounts.sql` | One-time migration: role check gains 'customer', trigger gives staff only to invited users. |
| `supabase/auth-schema.sql` | Same trigger and check, for fresh setups. |
| `lib/auth/guard.ts` | Pure owner-route gating (`OWNER_PREFIXES`, `isOwnerPath`, `decideOwnerAccess`) — unit-tested, no Supabase. |
| `lib/auth/session.ts` | `UserRole` gains 'customer'; `requireRole("staff")` fixed to require staff/admin; new `requireStaff()`. |
| `lib/customer-account.ts` | `getCustomerBookings()` / `getCustomerOrders()` — own-data queries by session email. |
| `middleware.ts` | Reads the profile role; customers on owner routes go to /my-account (401 for API routes). |
| `app/my-account/page.tsx` | The customer area. |
| `app/my-account/sign-up/page.tsx` | Public customer sign-up. |
| `app/my-account/sign-in/page.tsx` | Customer sign-in (lands on /my-account, never /dashboard). |
| `app/login/page.tsx` | Owner sign-in, now with a "Are you a customer?" link. |
| `components/HamburgerMenu.tsx` | Customer menu rows; role label "Customer". |
| `app/admin/page.tsx` + `app/admin/actions.ts` | "Make staff" for customer rows; `setUserRole` accepts 'customer'. |
| `__tests__/guard.test.ts` | Gating decision matrix. |
| `__tests__/customer-account.test.ts` | Own-data query filters (stub client). |
| `__tests__/HamburgerMenu.test.tsx` | Customer menu cases. |

## Setup (user steps)

The workspace has no Supabase credentials, so these run on the
user's machine / Supabase dashboard, in order. Nothing here needs
running twice, and nothing touches the live site until the next
deploy (a separate go-ahead).

1. **Run the migration.** Supabase: SQL Editor -> New query -> paste
   `supabase/customer-accounts.sql` -> Run. It is safe to run again
   (the constraint is dropped before being re-added; the function
   uses CREATE OR REPLACE). This is the step that makes customer
   sign-up safe — do not let anyone sign up as a customer before it
   has run, or the old trigger will make them staff.
2. **Check the existing staff.** If any account was created by public
   sign-up before this migration (there should be none — there was
   no public sign-up), check its role in the SQL Editor:
   `select email, role from public.profiles;` and fix any that
   should not be staff.
3. **Email confirmation (already on by default).** Supabase
   dashboard -> Authentication -> Configuration: "Confirm email"
   should be enabled, so a new customer has to click the link in
   their confirmation email before signing in. The confirmation
   link goes to `/auth/callback?next=/my-account`, which is already
   an allow-listed redirect URL (Authentication -> URL
   Configuration -> Redirect URLs) from the owner setup — no new
   URL is needed. If confirmation is switched off, sign-up signs
   the customer straight in instead; both paths work.
4. **Sign up as a customer.** Open `/my-account/sign-up`, create an
   account with a fresh email, click the confirmation link, and sign
   in. The account appears on `/admin` (owner view) as role
   'customer'.

## How to test (on the clone — needs live Supabase)

- **Sign-up creates a customer, not staff:** sign up with a fresh
  email, confirm, sign in. On `/admin` (as the owner) the new
  account shows role 'customer'. In the SQL Editor:
  `select email, role from public.profiles where email =
  'new-customer@example.com';` — role is 'customer'.
- **Customer cannot reach owner pages:** signed in as the customer,
  open `/leads`, `/dashboard`, `/admin`, `/orders`, `/customers`,
  `/appointments`, `/employees`, `/profile` — each redirects to
  `/my-account`. `/api/leads` returns 401 JSON.
- **Customer sees only their own data:** book a service with the
  customer email (from the homepage form, signed out), and place a
  shop order with the same email. On `/my-account` both appear.
  Book a second service with a different email (or a phone number)
  — it does not appear on the first customer's page.
- **Phone-number bookings do not appear:** book with a phone number
  instead of an email — it is not on `/my-account`, and the page
  says why.
- **Owner invite still makes staff:** as the admin, invite a second
  email from `/admin` — the invited account starts as 'staff', as
  before, and can open the owner pages.
- **Menu:** signed in as the customer, open the hamburger menu —
  "My account" and "Log out" only, no owner links. Signed out, the
  menu shows "Customer sign in".
- **Staff sign-in unchanged:** `/login` still signs staff in, and
  the "Are you a customer?" link goes to the customer pages.

## Known limits (not tested here)

- **No live Supabase in this workspace.** The sign-up flow, the
  trigger, the middleware block and the email confirmation were
  verified by `npm run build`, `npm test` (gating matrix and query
  filters), and code review — not against a live project. The SQL
  in `supabase/customer-accounts.sql` was reviewed but not executed
  against a live project. Run it once and check the SQL Editor
  reports success before letting anyone sign up.
- **Bookings matched by email only.** See the known limit above:
  phone-number bookings never appear on `/my-account`. A separate
  email column on leads (or linking a booking to the signed-in
  account at booking time) would fix it, and is a later step if the
  studio wants it.
- **No customer password change from the area beyond the shared
  reset flow.** "Change password" goes to `/auth/update-password`,
  the same page staff use.
- **Customers cannot edit their name after sign-up.** The name
  comes from `user_metadata.full_name` (set once at sign-up) or is
  derived from the email. There is no edit-profile form yet.

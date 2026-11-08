# Auth — Lumen Hair Studio

Real login for the salon site, replacing the old v1 shared owner token.
There is no `LEADS_OWNER_TOKEN` any more: `/leads`, `/dashboard` and
`/admin` require a signed-in Supabase Auth account with an active
profile. The public site (homepage, chatbot, booking form) stays public
and works with no login at all.

**Invite-only, like a real business website.** There is no public
signup: nobody can create an account from the site. Staff join only
when an admin invites them from `/admin`, and the single owner admin
is seeded once by the site owner (see Setup below). Admin is a role an
existing admin grants — never something a visitor claims by signing up
first. (Customer-facing accounts, where customers can create accounts
of their own, are a separate later step and are NOT part of this
design: profiles are admin/staff only, and the booking flow is
unchanged.)

## Architecture

- **Supabase Auth + `@supabase/ssr`** (`@supabase/ssr` 0.12.x). The
  session lives in cookies, so server components, route handlers and
  the middleware all see the same signed-in user.
- **Two Supabase keys, kept apart:**
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the publishable/anon key. Public
    by design; the browser client uses it. Row Level Security still
    applies to every query it makes.
  - `SUPABASE_SERVICE_ROLE_KEY` — server only, in `lib/supabase.ts`.
    Bypasses RLS; used for lead storage, for admin reads/writes after
    the code has verified the caller is an admin, and for sending
    staff invites (`auth.admin.inviteUserByEmail`). It is never
    imported by client code.
- **Middleware (`middleware.ts`)** — refreshes the session on every
  request and guards `/leads`, `/dashboard`, `/admin` and
  `/api/leads/*`. Signed-out users are redirected to
  `/login?next=<path>` (pages) or get 401 JSON (API routes). A session
  alone is not enough: the middleware also checks the user has an
  active `profiles` row. When Supabase auth is not configured, the
  middleware passes every request through and the protected pages show
  their own "Auth not configured" notice.
- **Defense in depth** — the pages and API routes check the session
  themselves too (`lib/auth/session.ts`: `getSession()`,
  `requireAuth()`, `requireRole()`), so a request that somehow gets
  past the middleware is still stopped.
- **Profiles & roles (`supabase/auth-schema.sql`)** — `public.profiles`
  has one row per auth user: `role` (`admin` / `staff`) and `is_active`.
  A trigger on `auth.users` creates the row for every new user, always
  as `staff`. Admins manage users on `/admin` (promote/demote,
  deactivate/reactivate, invite).
- **Staff invites (`app/admin/actions.ts` `inviteUser`)** — an
  admin-only server action. It verifies the caller is an admin with
  `requireRole("admin")`, then calls
  `supabase.auth.admin.inviteUserByEmail(email, { redirectTo })` with
  the service-role client. The redirect URL is built from the request
  host, so it works on `localhost:3000` in dev and on the Vercel URL
  live, with no hardcoded domain. The invited person clicks the link
  in the email, `/auth/callback` exchanges the code for a session and
  sends them to `/auth/update-password`, where they set their first
  password. Their profile already exists as `staff` (created by the
  trigger when the invite was accepted).
- **RLS** — enabled on `profiles`, `site_settings` and `leads`. A user
  can read their own profile; admins can read/update all profiles;
  active staff/admins can read `site_settings` and read/update salon
  leads; only admins can update `site_settings`. The role checks in
  the policies use the security-definer helpers `is_active_staff()` /
  `is_admin()`, which bypass RLS when they read `profiles` so the
  policies cannot recurse on themselves. Profile rows are created by
  the trigger only — there is no client INSERT policy. Lead INSERT
  stays service-role only (the public booking form), exactly as before.
- **Site settings (`lib/site-settings.ts`)** — the single
  `site_settings` row (id = 1) holds business name, phone, email,
  address and hours, editable by admins on `/admin`. The homepage
  reads it server-side and falls back to `lib/business.ts` when it is
  not configured. Services, prices and the chatbot knowledge chunks
  still live in `lib/business.ts` — that is the documented next step,
  not part of this change.

## Files

| File | What it does |
|---|---|
| `lib/auth/browser.ts` | Browser client (`createBrowserClient`, anon key). Null when unconfigured. |
| `lib/auth/server.ts` | Server client (`createServerClient`, anon key + cookies). Null when unconfigured. |
| `lib/auth/session.ts` | `getSession()` / `getAuthUser()` / `getUserProfile()` / `requireAuth()` / `requireRole()` — authorized = session + active profile. |
| `middleware.ts` | Session refresh + route guard (see above). |
| `app/login/page.tsx` | Sign-in form. No signup link — staff join by invite. |
| `app/auth/callback/route.ts` | Exchanges `?code=` from Supabase email links (invite, password recovery) for a session, then redirects to `?next=` or `/dashboard`. |
| `app/auth/signout/route.ts` | POST sign-out, redirects to `/`. |
| `app/auth/reset-password/page.tsx` | Request a password-reset email. |
| `app/auth/update-password/page.tsx` | Set a new password from a recovery link, or a first password after accepting a staff invite. |
| `app/admin/page.tsx` + `app/admin/actions.ts` | Admin-only user list (promote/demote, deactivate/reactivate), "Invite staff" form, and site settings form. |
| `components/InviteStaffForm.tsx` | Client form for the invite action; shows its result inline. |
| `components/AuthNav.tsx` | Server component in the site nav: "Owner sign in" when logged out, "Dashboard" + "Sign out" when logged in. |
| `components/HomeClient.tsx` | The homepage's client part (hero, services, booking form). |
| `lib/site-settings.ts` | `getSiteSettings()` — DB row merged over `lib/business.ts` defaults. |
| `supabase/auth-schema.sql` | Profiles, site_settings, trigger (everyone starts as staff), helpers, RLS policies. |

## Setup (user steps)

The workspace has no Supabase credentials, so these steps run on the
user's machine / Supabase dashboard, in order:

1. **Re-run the SQL.** In Supabase: SQL Editor -> New query -> paste
   `supabase/auth-schema.sql` -> Run. (Run `supabase/schema.sql` first
   if the `leads` table does not exist yet.) It is safe to run twice —
   re-running is what replaces the old trigger (first profile = admin)
   with the new one (everyone starts as staff).
2. **Anon key.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` should already be in
   this project's `.env.local` (publishable/anon key from Supabase:
   Project Settings -> API Keys -> Publishable key). Restart the dev
   server after any `.env.local` change.
3. **Allow the callback URL.** Supabase dashboard -> Authentication ->
   URL Configuration -> Redirect URLs: add
   `http://localhost:3000/auth/callback` (dev). Add the production
   URL (`https://ai-chatbot-site-tawny.vercel.app/auth/callback`) when
   the site goes live — otherwise the invite and reset links are
   rejected. (The Site URL there should be the live site URL, or
   `http://localhost:3000` while testing locally.)
4. **Create the owner account.** Supabase dashboard -> Authentication
   -> Users -> Add user: enter the owner's email and a password, tick
   **Auto Confirm User**, and save. This creates the auth user; the
   trigger creates their profile as `staff`.
5. **Promote the owner to admin.** In Supabase: SQL Editor -> New
   query -> run this one line, with the owner's real email address:
   `update public.profiles set role = 'admin' where email = 'owner@example.com';`
   That is the only seed step, done once by the person setting the
   site up — no visitor can do it from the site.
6. **Sign in.** Open `/login` and sign in with the owner account. The
   nav now shows "Dashboard" + "Sign out", and `/admin` opens the
   admin area.
7. **Invite staff.** On `/admin`, "Invite staff": enter a colleague's
   email and click "Send invite". They get an email from Supabase,
   click the link, and set their first password on
   `/auth/update-password`. They start as staff; promote them on
   `/admin` if they need admin access.
8. **Vercel (later, separate go-ahead):** set
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project (Type Config,
   like the URL — it is public by design). Remove the old
   `LEADS_OWNER_TOKEN` from Vercel; nothing reads it any more.

## How to test

- **Logged-out redirect:** open `/leads`, `/dashboard`, `/admin` while
  signed out — each redirects to `/login?next=<path>`.
- **No public signup:** open `/signup` — 404. `/login` has no "Create
  an account" link.
- **Wrong password:** sign in with a wrong password — "Wrong email or
  password" shows, and you stay on `/login`.
- **Invite a staff member:** as the admin, invite a second email
  address from `/admin` — "Invite sent to …" shows. Click the link in
  the email, set a password on `/auth/update-password`, and sign in.
  The new account starts as staff: it can view `/leads` and
  `/dashboard` but `/admin` shows "Admins only".
- **Invite validation:** invite with a blank or malformed email — a
  clear error shows and no email is sent. Invite an email that already
  has an account — "already has an account" shows.
- **Promote:** as the admin, open `/admin`, click "Make admin" on the
  staff user — they can now open `/admin` too.
- **Deactivate:** as the admin, click "Deactivate" on a user — they can
  no longer sign in (middleware sends them back to `/login`). Click
  "Reactivate" to restore them.
- **Last-admin guard:** try to demote or deactivate the only active
  admin — the action is refused ("Cannot demote/deactivate the last
  active admin").
- **Settings save:** on `/admin`, change the phone number and save —
  the homepage header shows the new number.
- **Password reset:** on `/login`, "Forgot your password?" -> enter
  your email -> click the link in the email -> set a new password on
  `/auth/update-password` -> sign in with it.
- **Sign out:** click "Sign out" in the nav — the nav goes back to
  "Owner sign in" and `/leads` redirects to `/login` again.
- **Booking form still public:** submit a booking without signing in —
  it still saves (service-role key, unchanged).

## What changed vs the old design

- **Public signup is gone.** `app/signup/page.tsx` is deleted; `/login`
  has no "Create an account" link; `/signup` is a 404.
- **The first-admin trigger is gone.** `handle_new_user()` in
  `supabase/auth-schema.sql` now creates every profile as `staff`.
  The owner is seeded once with the one-line SQL in Setup step 5.
- **Staff join by invite.** New: `inviteUser` in `app/admin/actions.ts`
  and `components/InviteStaffForm.tsx` on `/admin`. The invite email
  comes from Supabase's default sender unless the project configures
  its own SMTP.
- **Customer accounts are NOT built.** Profiles stay admin/staff only.
  That is a separate later step, decided by the user.

## What changed vs the token

- `LEADS_OWNER_TOKEN` is deleted everywhere: `lib/leads.ts` helpers,
  the `?token=` handling in `/leads` and `/dashboard`, the token
  params in `LeadsTable`'s status calls and the CSV link, the
  `requireOwner()` checks in `/api/leads/*`, and `.env.example`.
- The `x-leads-owner-token` header and `Authorization: Bearer` token
  forms are gone too — the session cookie authenticates requests now.
- `LEADS.md` and `DASHBOARD.md` describe login instead of the token.

## Known limits (not tested here)

- **The full invite flow was NOT tested end to end in this
  workspace** — there are no Supabase credentials here, so no real
  auth user exists, no invite email was sent, and no live Supabase
  project was touched. What was verified instead: `npm run build`
  passes, the chatbot eval passes 7/7, and with no env vars the dev
  server shows the homepage (200), the login page renders with no
  signup link, `/signup` is a 404, logged-out `/leads`, `/dashboard`,
  `/admin` redirect to `/login`, and `/api/leads` returns 401 JSON —
  nothing crashes when Supabase is unconfigured.
- **The SQL in `supabase/auth-schema.sql` was reviewed but not
  executed against a live project.** Re-run it once and check the
  Supabase SQL Editor reports success; if a policy name already exists
  from an earlier run, the `drop policy if exists` lines handle it.
  The owner-promote line in Setup step 5 must use the owner's real
  email address, and only matches a profile row that already exists
  (create the user first, step 4).
- **Invite and reset emails come from Supabase's default sender**
  unless the project configures its own SMTP — fine for the demo,
  worth changing for a real client. The `/auth/callback` redirect URL
  must be allow-listed in Supabase Auth settings (Setup step 3) or the
  links in those emails are rejected.
- **Services, prices and chatbot knowledge still live in
  `lib/business.ts`.** The admin settings form edits only business
  name, phone, email, address and hours. Moving services/prices (and
  the chatbot chunks) into the database so an admin can edit them from
  the site is the documented next step.

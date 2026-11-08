# Auth — Lumen Hair Studio

Real login for the salon site, replacing the old v1 shared owner token.
There is no `LEADS_OWNER_TOKEN` any more: `/leads`, `/dashboard` and
`/admin` require a signed-in Supabase Auth account with an active
profile. The public site (homepage, chatbot, booking form) stays public
and works with no login at all.

## Architecture

- **Supabase Auth + `@supabase/ssr`** (`@supabase/ssr` 0.12.x). The
  session lives in cookies, so server components, route handlers and
  the middleware all see the same signed-in user.
- **Two Supabase keys, kept apart:**
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the publishable/anon key. Public
    by design; the browser client uses it. Row Level Security still
    applies to every query it makes.
  - `SUPABASE_SERVICE_ROLE_KEY` — server only, in `lib/supabase.ts`.
    Bypasses RLS; used for lead storage and for admin reads/writes
    after the code has verified the caller is an admin. It is never
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
  A trigger on `auth.users` creates the row on signup: the FIRST
  profile ever created becomes `admin` (owner bootstrap); every later
  one starts as `staff`. Admins manage users on `/admin`.
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
| `app/login/page.tsx` | Sign-in form. |
| `app/signup/page.tsx` | Sign-up form. First account = admin. |
| `app/auth/callback/route.ts` | Exchanges `?code=` from Supabase email links for a session. |
| `app/auth/signout/route.ts` | POST sign-out, redirects to `/`. |
| `app/auth/reset-password/page.tsx` | Request a password-reset email. |
| `app/auth/update-password/page.tsx` | Set a new password from a recovery link. |
| `app/admin/page.tsx` + `app/admin/actions.ts` | Admin-only user list (promote/demote, deactivate/reactivate) and site settings form. |
| `components/AuthNav.tsx` | Server component in the site nav: "Owner sign in" when logged out, "Dashboard" + "Sign out" when logged in. |
| `components/HomeClient.tsx` | The homepage's client part (hero, services, booking form). |
| `lib/site-settings.ts` | `getSiteSettings()` — DB row merged over `lib/business.ts` defaults. |
| `supabase/auth-schema.sql` | Profiles, site_settings, trigger, helpers, RLS policies. |

## Setup (user steps)

The workspace has no Supabase credentials, so these steps run on the
user's machine / Supabase dashboard:

1. **Run the SQL.** In Supabase: SQL Editor -> New query -> paste
   `supabase/auth-schema.sql` -> Run. (Run `supabase/schema.sql` first
   if the `leads` table does not exist yet.) It is safe to run twice.
2. **Add the anon key.** In this project folder, add to `.env.local`:
   `NEXT_PUBLIC_SUPABASE_ANON_KEY=` with the publishable/anon key from
   Supabase: Project Settings -> API -> anon / publishable. (The URL
   and service-role key are already there.) Restart the dev server.
3. **Sign up the first account.** Open `/signup`, create an account
   with an email and password. It becomes the owner **admin**
   automatically — the first profile ever created gets the admin role.
4. **Email confirmation — pick one:**
   - **Leave it on (default):** Supabase emails a confirmation link.
     Click it; the link goes through `/auth/callback` and signs you
     in. Until then the signup page says "Check your email to confirm
     your account".
   - **Turn it off (demo only):** Supabase dashboard -> Authentication
     -> Providers -> Email -> turn off "Confirm email". Signups then
     sign in immediately with no email step. Fine for the demo; a real
     client site should leave confirmation on.
5. **Vercel (later, separate go-ahead):** set
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project (Type Config,
   like the URL — it is public by design). Remove the old
   `LEADS_OWNER_TOKEN` from Vercel; nothing reads it any more.

## How to test

- **Logged-out redirect:** open `/leads`, `/dashboard`, `/admin` while
  signed out — each redirects to `/login?next=<path>`.
- **Wrong password:** sign in with a wrong password — "Wrong email or
  password" shows, and you stay on `/login`.
- **Second user = staff:** sign up a second account — it starts as
  staff. It can view `/leads` and `/dashboard` but `/admin` shows
  "Admins only".
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

## What changed vs the token

- `LEADS_OWNER_TOKEN` is deleted everywhere: `lib/leads.ts` helpers,
  the `?token=` handling in `/leads` and `/dashboard`, the token
  params in `LeadsTable`'s status calls and the CSV link, the
  `requireOwner()` checks in `/api/leads/*`, and `.env.example`.
- The `x-leads-owner-token` header and `Authorization: Bearer` token
  forms are gone too — the session cookie authenticates requests now.
- `LEADS.md` and `DASHBOARD.md` describe login instead of the token.

## Known limits (not tested here)

- **The full signup/login flow was NOT tested end to end in this
  workspace** — there are no Supabase credentials here, so no real
  auth user exists and no live Supabase project was touched. What was
  verified instead: `npm run build` passes, the chatbot eval passes
  7/7, and with no env vars the dev server shows the homepage (200),
  the login/signup/reset pages render, logged-out `/leads`,
  `/dashboard`, `/admin` redirect to `/login`, and `/api/leads`
  returns 401 JSON — nothing crashes when Supabase is unconfigured.
- **The SQL in `supabase/auth-schema.sql` was reviewed but not
  executed against a live project.** Run it once and check the Supabase
  SQL Editor reports success; if a policy name already exists from an
  earlier run, the `drop policy if exists` lines handle it.
- **Services, prices and chatbot knowledge still live in
  `lib/business.ts`.** The admin settings form edits only business
  name, phone, email, address and hours. Moving services/prices (and
  the chatbot chunks) into the database so an admin can edit them from
  the site is the documented next step.
- **No email sending is configured here.** Confirmation and
  password-reset emails come from Supabase's default sender unless the
  project configures its own SMTP — fine for the demo, worth changing
  for a real client.

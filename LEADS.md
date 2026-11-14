# Leads — Lumen Hair Studio

Booking requests from the site are saved to Supabase, listed for the owner
at `/leads`, and exportable as CSV. One Supabase project serves **both**
demos: rows are separated by a `business` column (`salon` / `plumbing`),
and each site only ever reads its own (`business = "salon"`).

No payment details are collected or stored anywhere.

## What is built

- `POST /api/lead` — the booking form. Saves the lead with status `new`.
  Without Supabase keys it falls back to console.log and replies
  `saved: false`, so the site still works in demo mode.
- `GET /leads` — owner list, newest first: date/time, name, contact,
  service, message, status, plus a repeat count per contact
  ("2nd enquiry from this contact"). A status dropdown per lead
  (new / contacted / booked / cancelled) updates it.
- `GET /api/leads` — the same list as JSON (owner only).
- `GET /api/leads/export` — CSV download, `leads-salon.csv`, columns
  `created_at,name,contact,service,message,status`, properly quoted.
- `POST /api/leads/status` — `{id, status}`, updates only this
  business's lead.
- `supabase/schema.sql` — the `leads` table. RLS is enabled with **no**
  public policies, so the public cannot read/write leads directly; only
  the server, using the service-role key, can.

## Owner protection — Supabase Auth login

`/leads` and all leads APIs require a signed-in account with an active
staff or admin profile — see AUTH.md. Sign in at `/login`; staff join
by admin invite from `/admin` (there is no public staff signup;
customers sign up themselves — see CUSTOMER_ACCOUNTS.md). There is no
shared token any more (the old `LEADS_OWNER_TOKEN` is gone and unused).

## Setup (user step — nothing here is wired up yet)

1. Create a free Supabase project at https://supabase.com (one project
   for both demos).
2. In Supabase: SQL Editor -> New query -> paste `supabase/schema.sql`
   -> Run. This creates the `leads` table and enables RLS.
3. In Supabase: SQL Editor -> New query -> paste
   `supabase/auth-schema.sql` -> Run. This creates the `profiles` and
   `site_settings` tables, the profile-creation trigger, and the RLS policies.
4. In Supabase: Project Settings -> API. Copy the Project URL, the
   `anon` / publishable key, and the `service_role` key (NOT the
   `sb_secret_` key).
5. In this project folder, copy `.env.example` to `.env.local` and fill in:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`. Never commit `.env.local`.
6. Restart the dev server: `npm run dev`.
7. Test: submit the booking form on the site, then sign in at `/login`
   with the owner account (see AUTH.md for the owner setup and staff
   invites) and open `/leads` — the new lead should appear, and
   "Download CSV" should give you `leads-salon.csv`.
8. Vercel (later, separate go-ahead): set the same three env vars in the
   Vercel project settings before redeploying, or the live site will
   keep running in demo mode (`saved: false`). Remove the old
   `LEADS_OWNER_TOKEN` from Vercel — it is no longer used.

## Testing without Supabase

With no keys set, `POST /api/lead` returns
`{ok: true, saved: false, ...}`, and `/leads` shows an "Auth is not
configured" notice. Signed-out requests to `/api/leads` return
`{error: "Sign in required."}` with status 401.

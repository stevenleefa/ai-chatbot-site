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

## Owner protection (v1, not full auth)

If `LEADS_OWNER_TOKEN` is set, `/leads` and all leads APIs require it:
`/leads?token=YOUR_TOKEN` (or the `x-leads-owner-token` header).
If it is not set, the page is open and shows a clear warning. For a
real client, replace this with proper auth (e.g. Supabase Auth) before
relying on it.

## Setup (user step — nothing here is wired up yet)

1. Create a free Supabase project at https://supabase.com (one project
   for both demos).
2. In Supabase: SQL Editor -> New query -> paste `supabase/schema.sql`
   -> Run. This creates the `leads` table and enables RLS.
3. In Supabase: Project Settings -> API. Copy the Project URL and the
   `service_role` key (NOT the anon key).
4. In this project folder, copy `.env.example` to `.env.local` and fill in:
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a long
   random `LEADS_OWNER_TOKEN`. Never commit `.env.local`.
5. Restart the dev server: `npm run dev`.
6. Test: submit the booking form on the site, then open
   `/leads?token=YOUR_TOKEN` — the new lead should appear, and
   "Download CSV" should give you `leads-salon.csv`.
7. Vercel (later, separate go-ahead): set the same three env vars in the
   Vercel project settings before redeploying, or the live site will
   keep running in demo mode (`saved: false`).

## Testing without Supabase

With no keys set, `POST /api/lead` returns
`{ok: true, saved: false, ...}`, `/api/leads` returns
`{ok: true, configured: false, leads: []}`, and
`/api/leads/export` returns just the CSV header row.

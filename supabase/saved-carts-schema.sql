-- Saved carts table — a signed-in customer can save a cart under a
-- label of their own choosing ("Monthly restock") and restore or
-- delete it later from /my-account. Run this ONCE in the Supabase
-- SQL Editor of the ai-leads project (the same project as the
-- leads table).
--
-- items is jsonb: an array of { id, quantity } — the product ids
-- come from the products table (or the static catalogue fallback)
-- and quantities are integers 1–99. The server helpers in
-- lib/saved-carts.ts validate the shape before inserting; the
-- ownership check (customer_email = the verified session email)
-- lives in those helpers too, not in a policy.

create table if not exists public.saved_carts (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  name text not null,
  items jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write saved carts through the public Supabase API. The server code
-- uses the service-role key, which bypasses RLS, so only the site's
-- own server code (lib/saved-carts.ts, called from server routes
-- and pages) can touch this table — the same pattern as
-- orders-schema.sql.
alter table public.saved_carts enable row level security;

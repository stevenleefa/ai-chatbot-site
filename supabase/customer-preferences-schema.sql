-- Customer display preferences — the per-customer colour theme,
-- font pairing, font size and accessibility options picked in
-- /my-account ("Display settings", see PERSONALIZATION.md). Run this
-- ONCE in the Supabase SQL Editor of the ai-leads project (the same
-- project as the leads table). One row per customer, keyed by the
-- auth user id, so the choice follows them across devices; the
-- on-device copy in localStorage ("lumen-preferences") is the
-- fallback when this table is not set up yet.
--
-- Values are validated server-side against the allowlists in
-- lib/personalization.ts (app/api/preferences/route.ts rejects
-- unknown theme/font/size values with 400) — the text columns here
-- carry no CHECK constraint, so a future theme can be added in code
-- without a migration.

create table if not exists public.customer_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'plum',
  font_pairing text not null default 'classic',
  font_size text not null default 'medium',
  high_contrast boolean not null default false,
  reduce_motion boolean not null default false,
  larger_text boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write preferences through the public Supabase API. The server code
-- uses the service-role key, which bypasses RLS, so only the site's
-- own server code (app/api/preferences/route.ts, keyed by the
-- verified session user id) can touch this table — the same pattern
-- as saved-carts-schema.sql and orders-schema.sql.
alter table public.customer_preferences enable row level security;

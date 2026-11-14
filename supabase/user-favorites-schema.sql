-- Favorite products — the many-to-many between a customer and the
-- products they favorited from the shop (see lib/favorites.ts and
-- /api/favorites). A favorite is one row per (customer, product):
-- the primary key is the pair, so favoriting the same product twice
-- is a no-op (upsert on the pair). Run this ONCE in the Supabase
-- SQL Editor of the ai-leads project (the same project as the leads
-- table). It only creates this one table, so it is safe to run
-- again (IF NOT EXISTS).
--
-- user_id is the Supabase Auth user id (profiles.id) — the same id
-- customer_preferences is keyed by. product_id is the catalogue id
-- (lib/products.ts: shampoo-1l, colour-care-mask, …), validated
-- server-side before any write; an unknown id is rejected with 400
-- and never reaches this table. There is no foreign key to the
-- products table: the shop catalogue can live in Supabase or fall
-- back to the static list, and a favorite of a product later
-- removed from the shop is simply not rendered (see
-- components/FavoriteProducts.tsx).

create table if not exists public.user_favorites (
  user_id uuid not null,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write favorites through the public Supabase API. The server code
-- uses the service-role key, which bypasses RLS, so only the site's
-- own server code (lib/favorites.ts, called from /api/favorites)
-- can touch this table — the same pattern as referrals-schema.sql.
alter table public.user_favorites enable row level security;

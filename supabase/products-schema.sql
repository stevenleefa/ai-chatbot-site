-- Products table for the Lumen shop — the catalogue moves from the
-- static list in lib/products.ts into Supabase so the owner can
-- manage it from /admin/products (stock, featured, sales, removals).
-- Run this ONCE in the Supabase SQL Editor of the ai-leads project
-- (the same project as the leads table). Re-running is safe: the
-- seed below upserts on id.
--
-- The static PRODUCTS list in lib/products.ts stays as the fallback:
-- lib/products-db.ts reads this table when Supabase is configured
-- and falls back to that list when it is not (or the query fails),
-- so the shop works with no Supabase at all.

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  category text not null,
  image text not null,
  in_stock boolean not null default true,
  featured boolean not null default false,
  active boolean not null default true,
  sale_type text null check (sale_type in ('percent', 'buyXGetY')),
  sale_percent integer null,
  sale_buy integer null,
  sale_get integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write products through the public Supabase API. The server code
-- uses the service-role key, which bypasses RLS, so only the site's
-- own server code (shop page, checkout, admin actions) can touch
-- this table — the same pattern as orders-schema.sql.
alter table public.products enable row level security;

-- At most ONE featured product: the admin action that features a
-- product must un-feature the old one first (set featured = false
-- on it), otherwise this index makes the update fail.
create unique index if not exists products_one_featured_idx
  on public.products (featured) where featured = true;

-- Seed: the same 15 products as lib/products.ts, with the starting
-- states baked in — Scalp scrub + Hair oil out of stock, Colour-care
-- mask the one featured product, Colour-care shampoo 15% off,
-- Shampoo (1L) buy 2 get 1 free. Everything else in stock, not
-- featured, active, no sale.
insert into public.products
  (id, name, description, price_cents, category, image, in_stock, featured, active, sale_type, sale_percent, sale_buy, sale_get)
values
  ('shampoo-1l', 'Shampoo (1L)', 'The studio''s everyday shampoo — gentle, for all hair types.', 2400, 'Hair care', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=800&q=80&auto=format&fit=crop', true, false, true, 'buyXGetY', null, 2, 1),
  ('conditioner-1l', 'Conditioner (1L)', 'The matching conditioner — soft, detangled hair after every wash.', 2200, 'Hair care', 'https://images.unsplash.com/photo-1519735777090-ec97162dc266?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('colour-care-shampoo', 'Colour-care shampoo', 'Sulphate-free wash that keeps colour vivid for longer.', 2800, 'Colour care', 'https://images.unsplash.com/photo-1601070846144-6be3aad73f7b?w=800&q=80&auto=format&fit=crop', true, false, true, 'percent', 15, null, null),
  ('colour-care-mask', 'Colour-care mask', 'A weekly deep mask for coloured hair — soft, shiny, protected.', 3200, 'Colour care', 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80&auto=format&fit=crop', true, true, true, null, null, null, null),
  ('hairspray', 'Hairspray', 'Flexible hold that brushes out — no crunch, no stiffness.', 1800, 'Styling', 'https://images.unsplash.com/photo-1629458681434-e321fc1fd906?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('styling-gel', 'Styling gel', 'A versatile gel for definition, texture and all-day hold.', 1600, 'Styling', 'https://images.unsplash.com/photo-1556217256-dcd735bb8711?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('leave-in-treatment', 'Leave-in treatment', 'Leave-in softness for dry ends — especially after balayage.', 2600, 'Treatment', 'https://images.unsplash.com/photo-1597354984706-fac992d9306f?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('heat-protect-spray', 'Heat protect spray', 'Shields hair from heat styling and keeps colour from fading.', 2000, 'Styling', 'https://images.unsplash.com/photo-1593560368818-bd0c238ef976?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('beard-oil', 'Beard oil', 'Keeps a beard soft and tidy between trims — a little goes a long way.', 1400, 'Beard care', 'https://images.unsplash.com/photo-1627875777089-d32f1127e9ff?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('styling-cream', 'Styling cream', 'A light cream for smooth, frizz-free styling with a natural finish.', 1900, 'Styling', 'https://images.unsplash.com/photo-1547997825-ac153dc46a97?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('dry-shampoo', 'Dry shampoo', 'Refreshes hair between washes — volume and a clean feel, no water.', 1700, 'Styling', 'https://images.unsplash.com/photo-1610595426075-eed5a3f521ee?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('hair-oil', 'Hair oil', 'A few drops for shine and smoothness on dry or frizzy hair.', 2500, 'Treatment', 'https://images.unsplash.com/photo-1591130901921-3f0652bb3915?w=800&q=80&auto=format&fit=crop', false, false, true, null, null, null, null),
  ('scalp-scrub', 'Scalp scrub', 'A gentle weekly scrub for a healthy scalp and lighter-feeling hair.', 2100, 'Hair care', 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=800&q=80&auto=format&fit=crop', false, false, true, null, null, null, null),
  ('colour-care-gift-set', 'Colour care gift set', 'Colour-care shampoo + colour-care mask, boxed — the gift for coloured hair.', 5600, 'Gift sets', 'https://images.unsplash.com/photo-1592150282082-37698debe277?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null),
  ('everyday-gift-set', 'Everyday gift set', 'Shampoo, conditioner and styling gel, boxed — the everyday trio.', 4400, 'Gift sets', 'https://images.unsplash.com/photo-1451443700141-5ddb6d85a8fc?w=800&q=80&auto=format&fit=crop', true, false, true, null, null, null, null)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  category = excluded.category,
  image = excluded.image,
  in_stock = excluded.in_stock,
  featured = excluded.featured,
  active = excluded.active,
  sale_type = excluded.sale_type,
  sale_percent = excluded.sale_percent,
  sale_buy = excluded.sale_buy,
  sale_get = excluded.sale_get,
  updated_at = now();

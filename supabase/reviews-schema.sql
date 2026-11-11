-- Reviews schema for the Lumen public reviews (homepage section).
-- Run this ONCE in the Supabase SQL Editor of the ai-leads project
-- (the same project as the leads table). Visitor reviews are saved
-- by /api/reviews with status 'pending' and only appear on the site
-- once an admin approves them on /admin. The seed reviews on the
-- homepage are demo data in code (lib/reviews.ts), not rows here.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  rating integer not null check (rating between 1 and 5),
  text text not null,
  service text,
  status text not null default 'pending'
    check (status in ('pending', 'approved'))
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write reviews through the public Supabase API. The server code uses
-- the service-role key, which bypasses RLS, so only the site's own
-- API routes (GET returns approved rows only) can touch this table.
alter table public.reviews enable row level security;

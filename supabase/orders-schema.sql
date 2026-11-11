-- Orders schema for the Lumen shop (Stripe Checkout, in-store pickup).
-- Run this ONCE in the Supabase SQL Editor of the ai-leads project
-- (the same project as the leads table). Orders are created by
-- /api/checkout with status 'pending' and marked 'paid' by
-- /products/success only after Stripe confirms the payment.
-- No card details are ever stored here — Stripe holds the payment.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business text not null default 'salon'
    check (business in ('salon', 'plumbing')),
  customer_name text not null,
  customer_email text not null,
  items jsonb not null,
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'usd',
  stripe_session_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled'))
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write orders through the public Supabase API. The server code uses
-- the service-role key, which bypasses RLS, so only the site's own
-- API routes (which filter by business) can touch this table.
alter table public.orders enable row level security;

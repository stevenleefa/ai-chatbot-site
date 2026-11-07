-- Leads schema for BOTH demos (Lumen Hair Studio + SwiftFix Plumbing).
-- Run this ONCE in the Supabase SQL Editor of a SINGLE Supabase project.
-- One project serves both sites: rows are separated by the `business`
-- column ("salon" / "plumbing"), so each site only ever reads its own.
-- No payment details are stored in this table.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business text not null check (business in ('salon', 'plumbing')),
  name text not null,
  contact text not null,
  service text not null,
  message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'booked', 'cancelled'))
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write leads through the public Supabase API. The server code uses the
-- service-role key, which bypasses RLS, so only the site's own API routes
-- (which filter by business) can touch this table.
alter table public.leads enable row level security;

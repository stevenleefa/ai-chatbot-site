-- Referrals table for "refer a friend" — a customer shares a link
-- like https://ai-chatbot-site-tawny.vercel.app/?ref=<code>; when
-- the friend books, the referrer earns a 50%-off-a-haircut credit.
-- Run this ONCE in the Supabase SQL Editor of the ai-leads project
-- (the same project as the leads table).
--
-- Statuses: 'pending' (code issued, friend has not booked yet),
-- 'completed' (friend booked — the referrer holds an unused credit),
-- 'redeemed' (the referrer spent the credit on a Haircut booking).
-- The helpers in lib/referrals.ts drive every transition; nothing
-- here is ever written by the browser.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  referrer_email text not null,
  referred_email text null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'redeemed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

-- Row Level Security ON, with NO public policies: nobody can read or
-- write referrals through the public Supabase API. The server code
-- uses the service-role key, which bypasses RLS, so only the site's
-- own server code (lib/referrals.ts, called from server routes and
-- pages) can touch this table — the same pattern as orders-schema.sql.
alter table public.referrals enable row level security;

-- Auth schema for the Lumen Hair Studio site (Supabase Auth).
-- Run this ONCE in the Supabase SQL Editor, AFTER supabase/schema.sql.
-- It is safe to run again: tables use IF NOT EXISTS, the function uses
-- CREATE OR REPLACE, and policies are dropped before being created.
--
-- What it creates:
--   public.profiles      — one row per auth user, with a role + active flag.
--   public.site_settings — a single row (id = 1) of editable site info.
--   RLS policies so the database itself enforces who can see/change what.
--   A trigger that creates a profiles row on every new auth signup:
--     the FIRST profile ever created becomes 'admin' (owner bootstrap);
--     every later one becomes 'staff'.
--   Helper functions is_active_staff() / is_admin() used by the policies.
--     They are SECURITY DEFINER so they bypass RLS when they read
--     public.profiles — without that, the policies would recurse on
--     themselves. They only ever check the caller's own row (auth.uid()).
--
-- The leads table is NOT changed except for two ADDITIVE policies:
-- authenticated active staff/admins can SELECT and UPDATE salon leads.
-- INSERT stays service-role only (no client INSERT policy), and the
-- public booking form (POST /api/lead) still inserts via the service-role
-- key exactly as before.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'staff'
    check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Runs on every new auth.users row. The first profile ever created is
-- the owner, so it becomes admin; everyone after that starts as staff
-- and must be promoted by an admin on /admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when (select count(*) from public.profiles) = 0
      then 'admin'
      else 'staff'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------ site settings
create table if not exists public.site_settings (
  id int primary key,
  business_name text,
  phone text,
  email text,
  address text,
  hours text,
  updated_at timestamptz not null default now()
);

-- Seed the single row with the salon's current details (same values as
-- lib/business.ts). The site reads this row when configured and falls back
-- to lib/business.ts when it is not.
insert into public.site_settings
  (id, business_name, phone, email, address, hours)
values (
  1,
  'Lumen Hair Studio',
  '(555) 014-8890',
  'hello@lumenhairstudio.example',
  '12 Maple Street',
  'Tuesday to Saturday, 9am to 6pm. Closed Sunday and Monday.'
)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- ------------------------------------------------------- role-check helpers
-- SECURITY DEFINER so they bypass RLS on public.profiles (otherwise a
-- policy that calls them would recurse). They only inspect auth.uid()'s
-- own row, so they cannot leak another user's data.
create or replace function public.is_active_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = 'admin'
  );
$$;

-- ---------------------------------------------------------- profiles policies
-- No client INSERT policy: rows are created only by the trigger above.
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------- site_settings policies
-- Any signed-in active staff/admin can read the settings (the public
-- homepage reads them server-side with the service-role key instead).
drop policy if exists "Active staff can read site settings" on public.site_settings;
create policy "Active staff can read site settings"
  on public.site_settings for select
  using (public.is_active_staff());

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------ leads policies
-- Additive only. The service-role key bypasses RLS and keeps working
-- exactly as before (public booking form inserts, server list/export).
-- These policies let signed-in active staff/admins read and update
-- THIS site's leads through their own session as well. No INSERT policy:
-- only the server (service role) inserts leads.
drop policy if exists "Active staff can read salon leads" on public.leads;
create policy "Active staff can read salon leads"
  on public.leads for select
  using (business = 'salon' and public.is_active_staff());

drop policy if exists "Active staff can update salon leads" on public.leads;
create policy "Active staff can update salon leads"
  on public.leads for update
  using (business = 'salon' and public.is_active_staff())
  with check (business = 'salon' and public.is_active_staff());

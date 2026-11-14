-- Customer accounts for the Lumen Hair Studio site.
-- Run this ONCE in the Supabase SQL Editor, AFTER supabase/auth-schema.sql
-- has been run at least once. It is safe to run again: the constraint is
-- dropped before being re-added, and the function uses CREATE OR REPLACE.
--
-- What it changes (and why):
--   1. The profiles role check gains 'customer'. Before this, the check
--      only allowed ('admin', 'staff'), so a customer profile row could
--      not exist at all.
--   2. The handle_new_user() trigger stops making every new profile a
--      staff member. Invited users (invited_at is set by
--      inviteUserByEmail, which is how staff join) still become 'staff'.
--      Everyone else — a public sign-up from /my-account/sign-up, or a
--      user added in the Supabase dashboard — becomes 'customer'.
--      Admin is NEVER granted by this trigger: it is only ever set by an
--      existing admin (on /admin, or the one-time owner-seed SQL).
--
-- This matters because the customer sign-up page is public. Without this
-- change, every customer who signed up would get a 'staff' profile and
-- could open the owner pages (/leads, /dashboard, /admin). The site code
-- also blocks customers from owner routes (middleware + page checks, see
-- CUSTOMER_ACCOUNTS.md), but the database must not hand out staff roles to the
-- public in the first place — that is the defence in depth.
--
-- After running this, also re-run supabase/auth-schema.sql at some point
-- if you ever reset the project: that file now carries the same trigger
-- and check, so a fresh setup gets customer accounts from the start.
-- (Re-running auth-schema.sql after this file does NOT undo it.)

-- ------------------------------------------------------------ role check
-- The inline check in auth-schema.sql is named profiles_role_check
-- (Postgres names an inline column check {table}_{column}_check).
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'staff', 'customer'));

-- ------------------------------------------------------- profile trigger
-- Runs on every new auth.users row. Invited staff become 'staff';
-- public sign-ups become 'customer'. The trigger itself
-- (on_auth_user_created on auth.users) already exists from
-- auth-schema.sql and does not need re-creating — replacing the
-- function is enough.
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
    case when new.invited_at is not null then 'staff' else 'customer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

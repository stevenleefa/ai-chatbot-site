-- Settings page fields — the preferred stylist and the email
-- notifications toggle picked in /settings (see PERSONALIZATION.md).
-- Run this ONCE in the Supabase SQL Editor of the ai-leads project
-- (the same project as the leads table). It only ADDS two columns
-- to the existing customer_preferences table, so it is safe to run
-- again (IF NOT EXISTS). No data is changed: existing rows keep
-- their theme/font/size/voice, and the new columns start at the
-- defaults (no preferred stylist, email notifications on) until the
-- customer picks something.
--
-- preferred_stylist is the stylist's full name (one of Amelia
-- Brooks, Sofia Reyes, Maya Chen, Jordan Lee, Priya Nair) or NULL
-- for no preference. It is validated server-side in
-- lib/personalization.ts (app/api/preferences rejects unknown names
-- with 400) — like the other text columns, there is no CHECK
-- constraint here, so the list can change in code without a
-- migration.
--
-- email_notifications is a boolean, default true: appointment
-- reminders and offers. It is a preference only — the site does not
-- yet send reminder or marketing emails (only Supabase Auth
-- invites/resets go out, via Yahoo SMTP).
--
-- Row Level Security is already ON for this table (from
-- customer-preferences-schema.sql) with NO public policies, and
-- adding columns does not change that — only the site's own server
-- code (app/api/preferences/route.ts, service-role key) can read
-- or write these columns.
--
-- NOTE: run this together with supabase/customer-preferences-
-- voice.sql (not yet run either). Until both are run, POST
-- /api/preferences fails on the missing columns and the account
-- sync falls back to on-device only — the settings still work,
-- they just do not follow the account across devices yet.

alter table public.customer_preferences
  add column if not exists preferred_stylist text,
  add column if not exists email_notifications boolean default true;

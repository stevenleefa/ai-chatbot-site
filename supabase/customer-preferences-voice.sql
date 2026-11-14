-- Assistant voice options — the voice, speed and pitch picked in
-- /my-account ("Display settings" → Voice, see PERSONALIZATION.md).
-- Run this ONCE in the Supabase SQL Editor of the ai-leads project
-- (the same project as the leads table). It only ADDS three columns
-- to the existing customer_preferences table, so it is safe to run
-- again (IF NOT EXISTS). No data is changed: existing rows keep
-- their theme/font/size, and the new columns start at the defaults
-- (no voice chosen = the browser default voice, normal speed and
-- pitch) until the customer picks something.
--
-- voice_uri is the speechSynthesis voiceURI of the chosen voice
-- (or the voice name, when the voice has no voiceURI). NULL means
-- the browser default voice. A voice picked on one device may not
-- exist on another — the site falls back to the default voice
-- there, it never errors (see lib/speech.ts findVoiceByUri).
--
-- voice_rate / voice_pitch are numbers in the range 0.5–2
-- (0.75 slow/low, 1 normal, 1.25 fast/high). They are validated
-- server-side in lib/personalization.ts (app/api/preferences
-- rejects out-of-range values with 400) — like the text columns
-- in customer-preferences-schema.sql, there is no CHECK
-- constraint here, so the range can change in code without a
-- migration.
--
-- Row Level Security is already ON for this table (from
-- customer-preferences-schema.sql) with NO public policies, and
-- adding columns does not change that — only the site's own server
-- code (app/api/preferences/route.ts, service-role key) can read
-- or write these columns.

alter table public.customer_preferences
  add column if not exists voice_uri text,
  add column if not exists voice_rate numeric default 1,
  add column if not exists voice_pitch numeric default 1;

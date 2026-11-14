-- Reschedule support for customer bookings: appointment_at holds
-- the rescheduled date/time for a booking. Nullable — existing
-- leads have none, and a booking that was never rescheduled keeps
-- it null. The ORIGINAL booking date/time lives in the lead's
-- message text (the booking form writes it there); appointment_at
-- only ever carries a later reschedule, so the original is never
-- overwritten. Run this ONCE in the Supabase SQL Editor of the
-- ai-leads project.

alter table public.leads
  add column if not exists appointment_at timestamptz;

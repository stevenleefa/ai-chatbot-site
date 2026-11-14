// Reschedule validation — pure logic, no Supabase, no dates from
// the client beyond the two strings. The customer picks a new date
// + time for their own booking (see /my-account); the route
// (app/api/my-bookings/[id]/reschedule/route.ts) calls this before
// writing anything, and the same rules are what the form enforces
// (date input min = tomorrow, time select 09:00–18:00).
//
// Rules: the date must be a real YYYY-MM-DD date strictly in the
// future (today is not reschedulable — the studio needs notice),
// a Monday–Saturday day (the studio is closed Sundays), and the
// time must be HH:MM within opening hours 09:00–18:00 inclusive.
// Comparisons use UTC dates so the result does not depend on the
// server's local timezone. `now` is injectable so tests can fix
// "today" (defaults to the real current time).

export type RescheduleValidation =
  | { ok: true; appointmentAt: string }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

export function validateReschedule(
  date: unknown,
  time: unknown,
  now: Date = new Date()
): RescheduleValidation {
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return { ok: false, error: "Pick a date (YYYY-MM-DD)." };
  }
  if (typeof time !== "string" || !TIME_RE.test(time)) {
    return { ok: false, error: "Pick a time (HH:MM)." };
  }
  const [, hourStr, minuteStr] = TIME_RE.exec(time) as RegExpExecArray;
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (hour < 9 || hour > 18 || minute < 0 || minute > 59) {
    return {
      ok: false,
      error: "Pick a time within opening hours, 9:00 AM–6:00 PM.",
    };
  }
  if (hour === 18 && minute !== 0) {
    return {
      ok: false,
      error: "Pick a time within opening hours, 9:00 AM–6:00 PM.",
    };
  }
  // A real calendar date: new Date("2026-02-30") rolls over to
  // March, so compare the round-tripped date string.
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return { ok: false, error: "Pick a real date." };
  }
  if (parsed.getUTCDay() === 0) {
    return {
      ok: false,
      error: "The studio is closed on Sundays — pick a Monday–Saturday date.",
    };
  }
  const today = now.toISOString().slice(0, 10);
  if (date <= today) {
    return {
      ok: false,
      error: "Pick a future date — today cannot be rescheduled.",
    };
  }
  return { ok: true, appointmentAt: `${date}T${time}:00.000Z` };
}

// Opening-hours time options for the reschedule time select:
// every 30 minutes from 09:00 to 18:00 inclusive.
export function rescheduleTimeOptions(): string[] {
  const options: string[] = [];
  for (let minutes = 9 * 60; minutes <= 18 * 60; minutes += 30) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return options;
}

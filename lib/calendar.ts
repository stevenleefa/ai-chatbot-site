// Month-calendar math — pure functions, no Supabase, no dates
// from the client beyond plain ISO strings. Used by the reusable
// Calendar component (components/Calendar.tsx) for the booking
// date picker, the reschedule date picker and the owner month view.
//
// All dates are ISO "YYYY-MM-DD" and are interpreted as UTC noon
// (the same "T12:00:00Z" trick AppointmentCalendar uses), so the
// result never depends on the browser's or the server's local
// timezone. Months are 1–12; the navigation window is 12 months
// either side of the current month.

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseISODate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

// Number of days in a month (month 1–12). Leap-year correct:
// Date.UTC(year, month, 0) is the last day of the given month
// (month is 0-indexed in Date.UTC, so `month` is the next month
// and day 0 rolls back to the last day of the one before it).
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Day of the week of the 1st of the month: 0 = Sunday … 6 = Saturday.
export function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

// Day of the week of an ISO date: 0 = Sunday … 6 = Saturday.
export function weekdayOf(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}

export function isSunday(iso: string): boolean {
  return weekdayOf(iso) === 0;
}

// "YYYY-MM" for a year/month (month 1–12).
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

// Shift a "YYYY-MM" key by n months (negative goes back), rolling
// the year over correctly: addMonths("2026-11", 2) = "2027-01".
export function addMonths(key: string, n: number): string {
  const { year, month } = parseMonthKey(key);
  const total = year * 12 + (month - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return monthKey(y, m);
}

// "November 2026" for a "YYYY-MM" key.
export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// "Tuesday, November 18, 2026" for an ISO date — the aria-label
// for a day button.
export function formatDayLong(iso: string): string {
  const { year, month, day } = parseISODate(iso);
  return `${WEEKDAY_NAMES[weekdayOf(iso)]}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

// Today's date as an ISO string (UTC, matching the reschedule
// validation in lib/reschedule.ts). `now` is injectable so tests
// can fix "today".
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// The navigable window for the calendar: 12 months back and 12
// months forward from the current month. If today is November
// 2026, the earliest month is November 2025 and the latest is
// November 2027.
export function monthWindow(today: string): { minMonth: string; maxMonth: string } {
  const current = today.slice(0, 7);
  return { minMonth: addMonths(current, -12), maxMonth: addMonths(current, 12) };
}

export function clampMonth(key: string, minMonth: string, maxMonth: string): string {
  if (key < minMonth) return minMonth;
  if (key > maxMonth) return maxMonth;
  return key;
}

// The month grid as a flat array of 5 or 6 rows × 7 columns
// (Sunday first). Each entry is either a day { iso, day } or null
// — null is a blank cell outside the month (leading/trailing
// alignment), rendered empty and never a button.
export function monthGrid(
  year: number,
  month: number
): Array<{ iso: string; day: number } | null> {
  const first = firstWeekday(year, month);
  const days = daysInMonth(year, month);
  const totalCells = Math.ceil((first + days) / 7) * 7;
  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < totalCells; i++) {
    const day = i - first + 1;
    cells.push(
      day >= 1 && day <= days
        ? { iso: toISODate(year, month, day), day }
        : null
    );
  }
  return cells;
}

// Whether an ISO date is bookable: a real calendar date, strictly
// after today (the studio needs notice — today itself is not
// bookable), and not a Sunday (closed). Mirrors the date half of
// validateReschedule in lib/reschedule.ts.
export function isBookableDate(iso: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== iso
  ) {
    return false;
  }
  if (parsed.getUTCDay() === 0) return false;
  return iso > today;
}

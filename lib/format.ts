// Tiny display helpers with no data imports — safe to import from
// client components (lib/customers.ts and lib/dashboard.ts carry the
// sales rows and must stay server-side).

// "2026-11-12" -> "Nov 12, 2026" (same shape as the fmtDate in
// lib/dashboard.ts, which must not be bundled into client code).
export function fmtDate(iso: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const d = new Date(iso + "T12:00:00Z");
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// 12-hour clock for display only — "15:00" -> "3:00 PM", "09:00" ->
// "9:00 AM". Stored times stay "HH:MM" so sorting still uses the
// stored value.
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Month calendar for the appointments diary (/appointments).
// Server component — no client JS needed: it is a plain grid of
// links, rendered once.
//
// November 2026 only. All 8 booked appointments are in November;
// there is no data for other months, so there is no month
// navigation (see CUSTOMERS.md). Weeks start on Sunday (US
// convention). November 2026 starts on a Sunday (Nov 1) and has 30
// days, so the grid is 5 rows: Nov 1–30 plus Dec 1–5 filling the
// last row, muted.
//
// Each day cell shows that day's appointments as small navy blocks:
// time + customer name (link to /customers/<id>) and the stylist
// name (link to /employees/<id>). The salon is open Tuesday to
// Saturday, 9am to 6pm, so Sundays and Mondays are closed — those
// cells are greyed out and labelled Closed. No appointment ever
// lands on a closed day.

import Link from "next/link";
import { employeeIdForName } from "@/lib/employees";

export type CalendarAppointment = {
  id: string;
  date: string; // YYYY-MM-DD, November 2026
  time: string; // e.g. "15:00"
  customerId: string;
  customerName: string;
  stylist: string;
};

const YEAR = 2026;
const MONTH = 11; // November
const DAYS_IN_MONTH = 30;
const MONTH_PREFIX = "2026-11";
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay(); // 0 Sun ... 6 Sat
}

export default function AppointmentCalendar({
  appointments,
}: {
  appointments: CalendarAppointment[];
}) {
  const first = isoDate(YEAR, MONTH, 1);
  const startOffset = weekday(first); // days from Sunday to Nov 1
  const totalCells =
    Math.ceil((startOffset + DAYS_IN_MONTH) / 7) * 7;
  const gridStart = addDays(first, -startOffset);

  const byDate = new Map<string, CalendarAppointment[]>();
  for (const a of appointments) {
    const list = byDate.get(a.date) ?? [];
    list.push(a);
    byDate.set(a.date, list);
  }

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const date = addDays(gridStart, i);
    const day = Number(date.slice(8, 10));
    const inMonth = date.slice(0, 7) === MONTH_PREFIX;
    const wd = weekday(date);
    const closed = wd === 0 || wd === 1; // Sundays and Mondays
    const dayAppts = byDate.get(date) ?? [];
    cells.push(
      <div
        key={date}
        className={`cal-cell${inMonth ? "" : " cal-outside"}${
          closed ? " cal-closed" : ""
        }`}
      >
        <div className="cal-day">{day}</div>
        {dayAppts.map((a) => (
          <div key={a.id} className="cal-appt">
            <Link href={`/customers/${a.customerId}`}>
              {a.time} {a.customerName}
            </Link>
            <br />
            <Link href={`/employees/${employeeIdForName(a.stylist)}`}>
              {a.stylist}
            </Link>
          </div>
        ))}
        {closed && inMonth && (
          <div className="cal-closed-label">Closed</div>
        )}
      </div>
    );
  }

  return (
    <div
      className="calendar"
      role="grid"
      aria-label="November 2026 appointments calendar"
    >
      {WEEKDAY_NAMES.map((d) => (
        <div key={d} className="cal-head">
          {d}
        </div>
      ))}
      {cells}
    </div>
  );
}

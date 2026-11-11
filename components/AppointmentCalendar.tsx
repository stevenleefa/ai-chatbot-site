// Appointments calendar for /appointments — month, week and day views.
// Client component (the view + anchor date live in the parent's state),
// but it only renders links and divs from the props it is given — it
// imports no data libs, so no sales rows are bundled to the browser.
//
// November 2026 only. All booked appointments are in November; there
// is no data for other months, so there is no month navigation (see
// CUSTOMERS.md). Weeks start on Sunday (US convention). November 2026
// starts on a Sunday (Nov 1) and has 30 days, so the month grid is 5
// rows: Nov 1–30 plus Dec 1–5 filling the last row, muted.
//
// Each day cell shows that day's appointments as small blocks coloured
// BY STYLIST (one colour per stylist — see STYLIST_COLOURS in
// lib/employees.ts; all pass WCAG 2.1 AA with white text): time (12-hour)
// + customer name (link to /customers/<id>) and the stylist name (link
// to /employees/<id>). Blocks are small with ellipsis so several fit
// in one cell. The salon is open Monday to Saturday, 9am to 6pm, so
// Sundays are closed — those cells are greyed out and labelled Closed.
// No appointment ever lands on a Sunday.

"use client";

import Link from "next/link";
import { formatTime } from "@/lib/format";

export type CalendarAppointment = {
  id: string;
  date: string; // YYYY-MM-DD, November 2026
  time: string; // "HH:MM" stored; displayed 12-hour via formatTime
  customerId: string;
  customerName: string;
  stylist: string;
  stylistId: string;
  colour: string; // that stylist's block colour
  service: string;
  status: "confirmed" | "requested";
};

export type CalendarView = "month" | "week" | "day";

const YEAR = 2026;
const MONTH = 11; // November
const DAYS_IN_MONTH = 30;
const MONTH_PREFIX = "2026-11";
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

// "2026-11-12" -> "Thu, Nov 12, 2026" (local helper — the shared
// fmtDate lives in lib/dashboard.ts, which must not be bundled here).
function fmtDay(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return `${WEEKDAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export default function AppointmentCalendar({
  appointments,
  view,
  anchorDate,
}: {
  appointments: CalendarAppointment[];
  view: CalendarView;
  anchorDate: string; // ISO date: the week/day shown in week/day view
}) {
  const byDate = new Map<string, CalendarAppointment[]>();
  for (const a of appointments) {
    const list = byDate.get(a.date) ?? [];
    list.push(a);
    byDate.set(a.date, list);
  }
  // Blocks in a cell are time order, earliest first.
  byDate.forEach((list) =>
    list.sort((a, b) => a.time.localeCompare(b.time))
  );

  // --- Day view: one day as a timed list -------------------------------
  if (view === "day") {
    const dayAppts = byDate.get(anchorDate) ?? [];
    return (
      <div>
        <h3>{fmtDay(anchorDate)}</h3>
        {dayAppts.length === 0 ? (
          <p>No appointments on this day.</p>
        ) : (
          <ul className="day-list">
            {dayAppts.map((a) => (
              <li key={a.id}>
                <strong>{formatTime(a.time)}</strong> —{" "}
                <Link href={`/customers/${a.customerId}`}>
                  {a.customerName}
                </Link>{" "}
                · {a.service} with{" "}
                <Link href={`/employees/${a.stylistId}`}>{a.stylist}</Link>{" "}
                <span
                  className="stylist-dot"
                  style={{ background: a.colour }}
                  aria-hidden="true"
                />{" "}
                <span
                  className={
                    a.status === "confirmed" ? "badge badge-ok" : "badge badge-low"
                  }
                >
                  {a.status === "confirmed" ? "Confirmed" : "Requested"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // --- Month and week views: 7-column grids ---------------------------
  let gridStart: string;
  let totalCells: number;
  let rangeLabel: string | null = null;
  if (view === "week") {
    gridStart = addDays(anchorDate, -weekday(anchorDate));
    totalCells = 7;
    rangeLabel = `Week of ${fmtDay(gridStart)} – ${fmtDay(addDays(gridStart, 6))}`;
  } else {
    const first = isoDate(YEAR, MONTH, 1);
    const startOffset = weekday(first); // days from Sunday to Nov 1
    totalCells = Math.ceil((startOffset + DAYS_IN_MONTH) / 7) * 7;
    gridStart = addDays(first, -startOffset);
  }

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const date = addDays(gridStart, i);
    const day = Number(date.slice(8, 10));
    const inMonth = date.slice(0, 7) === MONTH_PREFIX;
    const closed = weekday(date) === 0; // Sundays only (open Mon–Sat)
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
          <div
            key={a.id}
            className="cal-appt"
            style={{ background: a.colour }}
            title={`${formatTime(a.time)} — ${a.customerName}, ${a.service} with ${a.stylist}`}
          >
            <div className="cal-appt-line">
              <Link href={`/customers/${a.customerId}`}>
                {formatTime(a.time)} {a.customerName}
              </Link>
            </div>
            <div className="cal-appt-line">
              <Link href={`/employees/${a.stylistId}`}>{a.stylist}</Link>
            </div>
          </div>
        ))}
        {closed && inMonth && (
          <div className="cal-closed-label">Closed</div>
        )}
      </div>
    );
  }

  return (
    <div>
      {rangeLabel && <h3>{rangeLabel}</h3>}
      {/* Plain layout grid, not role="grid": a grid role needs row /
          gridcell children and arrow-key interaction, which this
          calendar does not have — and a grid with plain div children
          is worse for assistive tech than no role at all. The
          appointment links inside the cells are the keyboard path
          through the calendar (Tab reaches each one). */}
      <div className="calendar">
        {WEEKDAY_NAMES.map((d) => (
          <div key={d} className="cal-head">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

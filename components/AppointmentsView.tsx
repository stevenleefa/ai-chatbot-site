// Appointments view — the interactive part of /appointments.
// Client component (React 18, useState only): the stylist filter and
// the Month / Week / Day switcher are state, everything else is
// props from the server page. The Due-for-a-booking list is NOT part
// of this component — those customers have no appointment, so the
// filter does not apply to them; the server page renders it below.
//
// Filter: "All" plus one button per stylist. Clicking a stylist
// shows only their appointments in the calendar (all three views)
// and in the diary table; "All" restores everything. Priya has no
// appointments, so her filter shows the empty state.
//
// Views: Month is the full November grid; Week is a 7-day strip for
// the chosen week (prev/next-week buttons, clamped to the weeks that
// overlap November); Day is the chosen day as a timed list (prev/next
// buttons, clamped to Nov 1–30). Week and day default to the week/day
// of the first appointment. Times display 12-hour everywhere
// (formatTime); the stored "HH:MM" stays the sort value.

"use client";

import Link from "next/link";
import { useState } from "react";
import AppointmentCalendar, {
  type CalendarAppointment,
  type CalendarView,
} from "@/components/AppointmentCalendar";
import SortableTable, {
  type SortableColumn,
  type SortableRow,
} from "@/components/SortableTable";
import { formatTime, fmtDate } from "@/lib/format";

export type StylistFilter = {
  name: string;
  id: string; // first-name slug, e.g. "amelia"
  colour: string;
};

const NOV_START = "2026-11-01";
const NOV_END = "2026-11-30";
const FIRST_WEEK_START = "2026-11-01"; // Nov 1 is a Sunday
const LAST_WEEK_START = "2026-11-29"; // last week overlapping November

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay(); // 0 Sun ... 6 Sat
}

function weekStartOf(iso: string): string {
  return addDays(iso, -weekday(iso));
}

export default function AppointmentsView({
  appointments,
  stylists,
}: {
  appointments: CalendarAppointment[];
  stylists: StylistFilter[];
}) {
  const firstDate = appointments[0]?.date ?? NOV_START;
  const [view, setView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(firstDate);
  const [stylist, setStylist] = useState<string | null>(null);

  const filtered =
    stylist === null
      ? appointments
      : appointments.filter((a) => a.stylist === stylist);
  const stylistName = stylist ?? "All stylists";

  const weekStart = weekStartOf(anchorDate);
  const canPrevWeek = weekStart > FIRST_WEEK_START;
  const canNextWeek = weekStart < LAST_WEEK_START;
  const canPrevDay = anchorDate > NOV_START;
  const canNextDay = anchorDate < NOV_END;

  // Diary table for the filtered appointments (same columns as
  // before — the page used to build these server-side; the filter
  // needs them here). Time cell is 12-hour; the sort value stays
  // the stored "HH:MM".
  const diaryColumns: SortableColumn[] = [
    {
      label: (
        <>
          Date <span className="tag tag-appointments">Appointments</span>
        </>
      ),
      sortLabel: "Date",
    },
    { label: "Time", sortLabel: "Time" },
    {
      label: (
        <>
          Customer <span className="tag tag-people">People</span>
        </>
      ),
      sortLabel: "Customer",
    },
    {
      label: (
        <>
          Service <span className="tag tag-services">Services</span>
        </>
      ),
      sortLabel: "Service",
    },
    {
      label: (
        <>
          Stylist <span className="tag tag-people">People</span>
        </>
      ),
      sortLabel: "Stylist",
    },
    { label: "Status", sortLabel: "Status" },
  ];
  const diaryRows: SortableRow[] = filtered.map((a) => ({
    key: a.id,
    cells: [
      fmtDate(a.date),
      formatTime(a.time),
      <Link href={`/customers/${a.customerId}`}>{a.customerName}</Link>,
      a.service,
      <>
        <Link href={`/employees/${a.stylistId}`}>{a.stylist}</Link>{" "}
        <span
          className="stylist-dot"
          style={{ background: a.colour }}
          aria-label={`${a.stylist}'s colour`}
        />
      </>,
      a.status === "confirmed" ? (
        <span className="badge badge-ok">Confirmed</span>
      ) : (
        <span className="badge badge-low">Requested</span>
      ),
    ],
    // Date cell shows the pretty date; the sort value stays the
    // stored ISO date so dates sort by date, not by display text.
    sort: [
      a.date,
      a.time,
      a.customerName,
      a.service,
      a.stylist,
      a.status === "confirmed" ? "Confirmed" : "Requested",
    ],
  }));

  return (
    <>
      <section className="dash-section">
        <h2>Filter by stylist</h2>
        <p>
          Show appointments for one stylist, or all of them. The filter
          applies to the calendar and the diary below — the Due-for-a-
          booking list is not filtered.
        </p>
        <div
          className="filter-row"
          role="group"
          aria-label="Filter appointments by stylist"
        >
          <button
            type="button"
            className={`filter-btn${stylist === null ? " active" : ""}`}
            onClick={() => setStylist(null)}
            aria-pressed={stylist === null}
          >
            All
          </button>
          {stylists.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`filter-btn${stylist === s.name ? " active" : ""}`}
              onClick={() => setStylist(s.name)}
              aria-pressed={stylist === s.name}
            >
              <span
                className="stylist-dot"
                style={{ background: s.colour }}
                aria-hidden="true"
              />{" "}
              {s.name}
            </button>
          ))}
        </div>
      </section>

      <section className="dash-section">
        <h2>
          November 2026 calendar{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          Every booked appointment on the calendar — click a name to
          open that customer or stylist. Each block is coloured for
          its stylist (see the key below). Sundays are closed. The
          diary covers November 2026 only, so there is no month
          navigation.
        </p>

        <div
          className="view-tabs"
          role="group"
          aria-label="Calendar view: month, week or day"
        >
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
              aria-pressed={view === v}
            >
              {v === "month" ? "Month" : v === "week" ? "Week" : "Day"}
            </button>
          ))}
        </div>

        {view === "week" && (
          <div className="view-nav">
            <button
              type="button"
              onClick={() => setAnchorDate(addDays(anchorDate, -7))}
              disabled={!canPrevWeek}
            >
              ← Previous week
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(addDays(anchorDate, 7))}
              disabled={!canNextWeek}
            >
              Next week →
            </button>
          </div>
        )}
        {view === "day" && (
          <div className="view-nav">
            <button
              type="button"
              onClick={() => setAnchorDate(addDays(anchorDate, -1))}
              disabled={!canPrevDay}
            >
              ← Previous day
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(addDays(anchorDate, 1))}
              disabled={!canNextDay}
            >
              Next day →
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p>
            No appointments in November for {stylistName}. Try another
            stylist, or All.
          </p>
        ) : (
          <AppointmentCalendar
            appointments={filtered}
            view={view}
            anchorDate={anchorDate}
          />
        )}

        <p className="stylist-legend" aria-label="Stylist colours">
          Stylists:{" "}
          {stylists.map((s) => (
            <span key={s.id}>
              <span
                className="stylist-dot"
                style={{ background: s.colour }}
                aria-hidden="true"
              />{" "}
              <Link href={`/employees/${s.id}`}>{s.name}</Link>
              {s !== stylists[stylists.length - 1] ? " · " : ""}
            </span>
          ))}
        </p>
      </section>

      <section className="dash-section">
        <h2>
          Upcoming appointments — November 2026{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          {filtered.length}{" "}
          {filtered.length === 1 ? "appointment" : "appointments"} booked
          {stylist === null ? "" : ` for ${stylist}`}. Customer names
          link to their history. Click any column heading to sort by
          that column; click it again to reverse.
        </p>
        {filtered.length === 0 ? (
          <p>No appointments to show for {stylistName}.</p>
        ) : (
          <SortableTable columns={diaryColumns} rows={diaryRows} />
        )}
      </section>
    </>
  );
}

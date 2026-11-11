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
import { Fragment, useRef, useState } from "react";
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

  // Month / Week / Day are tabs (WAI-ARIA tabs, like DashboardTabs):
  // roving tabindex, arrow keys move and select, aria-selected and
  // aria-controls point at the calendar panel below.
  const VIEWS: { id: CalendarView; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "week", label: "Week" },
    { id: "day", label: "Day" },
  ];
  const viewTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const viewIndex = VIEWS.findIndex((v) => v.id === view);
  function focusViewTab(index: number) {
    const tab = viewTabRefs.current[index];
    if (!tab) return;
    tab.focus();
    setView(VIEWS[index].id);
  }
  function onViewTabKeyDown(e: React.KeyboardEvent, index: number) {
    const last = VIEWS.length - 1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusViewTab(index === last ? 0 : index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusViewTab(index === 0 ? last : index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusViewTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusViewTab(last);
    }
  }

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
          aria-hidden="true"
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
        {/* Native radio group: one shared name gives the group arrow-key
            navigation and single-select semantics for free; the labels
            are styled as the pill buttons. */}
        <fieldset className="filter-row">
          <legend className="visually-hidden">
            Filter appointments by stylist
          </legend>
          <input
            type="radio"
            className="filter-radio visually-hidden"
            id="filter-all"
            name="stylist-filter"
            checked={stylist === null}
            onChange={() => setStylist(null)}
          />
          <label className="filter-btn" htmlFor="filter-all">
            All
          </label>
          {stylists.map((s) => (
            <Fragment key={s.id}>
              <input
                type="radio"
                className="filter-radio visually-hidden"
                id={`filter-${s.id}`}
                name="stylist-filter"
                checked={stylist === s.name}
                onChange={() => setStylist(s.name)}
              />
              <label className="filter-btn" htmlFor={`filter-${s.id}`}>
                <span
                  className="stylist-dot"
                  style={{ background: s.colour }}
                  aria-hidden="true"
                />{" "}
                {s.name}
              </label>
            </Fragment>
          ))}
        </fieldset>
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
          role="tablist"
          aria-label="Calendar view: month, week or day"
        >
          {VIEWS.map((v, i) => {
            const selected = view === v.id;
            return (
              <button
                key={v.id}
                ref={(el) => {
                  viewTabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`cal-tab-${v.id}`}
                aria-selected={selected}
                aria-controls="calendar-panel"
                tabIndex={selected ? 0 : -1}
                className={selected ? "active" : ""}
                onClick={() => setView(v.id)}
                onKeyDown={(e) => onViewTabKeyDown(e, i)}
              >
                {v.label}
              </button>
            );
          })}
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

        <div
          id="calendar-panel"
          role="tabpanel"
          aria-labelledby={`cal-tab-${view}`}
        >
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
        </div>

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

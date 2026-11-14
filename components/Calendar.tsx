// Reusable month calendar — a full month grid with Prev / Next /
// Today navigation over a window of 12 months back and 12 months
// forward from the current month. Used in three places:
//   - the homepage booking form (preferred date picker),
//   - the reschedule form in /my-account (BookingActions),
//   - the owner month view on /appointments (with appointment counts).
//
// Dates are ISO "YYYY-MM-DD" (UTC, see lib/calendar.ts). Days are
// real <button> elements (type="button", so they never submit a
// surrounding form) with a full aria-label — "Tuesday, November
// 18, 2026", plus "Closed" for Sundays, "Selected" for the chosen
// day, and "N appointments" when a count is given. Tab reaches
// every enabled day and Enter/Space selects it; the month heading
// is aria-live="polite" so month changes are announced. Sundays
// are shown as closed; for booking/reschedule they are disabled
// (disableSundays), and past dates / dates before minDate are
// disabled too. For the owner view nothing is disabled — the owner
// taps any day to see its appointments. Leading/trailing cells
// outside the month are blank (not buttons).

"use client";

import { useState } from "react";
import "./Calendar.css";
import {
  addMonths,
  clampMonth,
  formatDayLong,
  isSunday,
  monthGrid,
  monthLabel,
  monthWindow,
  parseMonthKey,
  todayISO,
} from "@/lib/calendar";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarProps = {
  /** Selected date "YYYY-MM-DD", or null for none. */
  selected: string | null;
  /** Called with the ISO date when a selectable day is tapped. */
  onSelect: (date: string) => void;
  /** Earliest selectable date (inclusive). Days before it are disabled. */
  minDate?: string;
  /** Latest selectable date (inclusive). Days after it are disabled. */
  maxDate?: string;
  /** Disable dates before today. */
  disablePast?: boolean;
  /** Disable Sundays (the studio is closed). */
  disableSundays?: boolean;
  /** date -> appointment count; days with a count show a badge. */
  appointmentCounts?: Record<string, number>;
  /** "YYYY-MM" to show first; defaults to the selected date's month or the current month. */
  initialMonth?: string;
  /** Injectable "today" (ISO) for tests; defaults to the real UTC today. */
  today?: string;
  /** Accessible label for the calendar region. */
  ariaLabel?: string;
};

export default function Calendar({
  selected,
  onSelect,
  minDate,
  maxDate,
  disablePast = false,
  disableSundays = false,
  appointmentCounts,
  initialMonth,
  today,
  ariaLabel = "Calendar",
}: CalendarProps) {
  const todayStr = today ?? todayISO();
  const currentMonth = todayStr.slice(0, 7);
  const { minMonth, maxMonth } = monthWindow(todayStr);
  const startMonth = clampMonth(
    initialMonth ?? (selected ? selected.slice(0, 7) : currentMonth),
    minMonth,
    maxMonth
  );
  const [viewMonth, setViewMonth] = useState(startMonth);

  const canPrev = viewMonth > minMonth;
  const canNext = viewMonth < maxMonth;
  const isCurrentMonth = viewMonth === currentMonth;

  const { year, month } = parseMonthKey(viewMonth);
  const cells = monthGrid(year, month);

  function isDisabled(iso: string): boolean {
    if (disableSundays && isSunday(iso)) return true;
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    if (disablePast && iso < todayStr) return true;
    return false;
  }

  return (
    <div className="calendar" role="group" aria-label={ariaLabel}>
      <div className="cal-nav">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          disabled={!canPrev}
          aria-label="Previous month"
        >
          ← Prev
        </button>
        <h3 className="cal-heading" aria-live="polite">{monthLabel(viewMonth)}</h3>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          disabled={!canNext}
          aria-label="Next month"
        >
          Next →
        </button>
        <button
          type="button"
          onClick={() => setViewMonth(currentMonth)}
          disabled={isCurrentMonth}
        >
          Today
        </button>
      </div>

      <div className="cal-grid" role="group" aria-label={monthLabel(viewMonth)}>
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="cal-weekday" aria-hidden="true">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`blank-${i}`} className="cal-blank" aria-hidden="true" />;
          }
          const { iso, day } = cell;
          const closed = isSunday(iso);
          const isSelected = selected === iso;
          const isToday = iso === todayStr;
          const count = appointmentCounts?.[iso] ?? 0;
          const disabled = isDisabled(iso);
          const labelParts = [formatDayLong(iso)];
          if (closed) labelParts.push("Closed");
          if (isSelected) labelParts.push("Selected");
          if (count > 0)
            labelParts.push(`${count} appointment${count === 1 ? "" : "s"}`);
          return (
            <button
              key={iso}
              type="button"
              className={[
                "cal-day",
                isToday ? "cal-day-today" : "",
                isSelected ? "cal-day-selected" : "",
                closed ? "cal-day-closed" : "",
                count > 0 ? "cal-day-busy" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={labelParts.join(", ")}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onSelect(iso)}
            >
              <span aria-hidden="true">{day}</span>
              {count > 0 && (
                <span className="cal-count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

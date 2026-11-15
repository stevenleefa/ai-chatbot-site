"use client";

import { fmtDate, formatTime } from "@/lib/format";
import {
  firstName,
  getDaySlots,
  type BookedAppointment,
} from "@/lib/daily-view";

// The daily view for the homepage booking form: the time slots for
// the picked date, below the month calendar. A slot shows the time
// and, when a stylist is already booked at that time, which one
// ("Maya booked") — visitor view is busy vs free only, so no
// customer name ever appears here (the diary rows this receives
// carry no customer data at all). A slot is still tappable while
// any stylist is free at that time; it is disabled only when every
// bookable stylist is booked ("Fully booked"). Sundays are closed.
// Slots are real buttons (keyboard accessible) with a clear
// selected state.
export default function DailyView({
  date,
  booked,
  slots,
  bookableStylists,
  selectedTime,
  onSelectTime,
}: {
  date: string;
  booked: BookedAppointment[];
  slots: string[];
  bookableStylists: string[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}) {
  const { closed, slots: daySlots } = getDaySlots(
    date,
    booked,
    slots,
    bookableStylists
  );
  return (
    <div className="daily-view">
      <h3>Times on {fmtDate(date)}</h3>
      {closed ? (
        <p>
          Closed on Sundays — we&apos;re open Monday to Saturday, 9am to
          6pm.
        </p>
      ) : (
        <>
          <p>Tap a time to add it to your booking request.</p>
          <ul className="daily-slots">
            {daySlots.map((s) => {
              const selected = selectedTime === s.time;
              const full = s.status === "full";
              const label = full
                ? `${formatTime(s.time)}, fully booked`
                : s.bookedStylists.length > 0
                  ? `${formatTime(s.time)}, ${s.bookedStylists
                      .map(firstName)
                      .join(", ")} booked`
                  : `${formatTime(s.time)}, available`;
              return (
                <li key={s.time}>
                  <button
                    type="button"
                    className={[
                      "daily-slot",
                      selected ? "daily-slot-selected" : "",
                      full ? "daily-slot-full" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={selected}
                    aria-label={label}
                    disabled={full}
                    onClick={() => onSelectTime(s.time)}
                  >
                    <span>{formatTime(s.time)}</span>
                    {full ? (
                      <span>Fully booked</span>
                    ) : s.bookedStylists.length > 0 ? (
                      <span>
                        {s.bookedStylists.map(firstName).join(", ")} booked
                      </span>
                    ) : (
                      <span>Available</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

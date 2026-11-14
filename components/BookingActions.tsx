"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/components/Calendar";
import { fmtDate, formatTime } from "@/lib/format";
import { isBookableDate } from "@/lib/calendar";
import { rescheduleTimeOptions } from "@/lib/reschedule";

// Reschedule / Cancel actions for one of the customer's own bookings
// (the My bookings table in /my-account). The page is a server
// component, so the interactive parts live here. Both actions POST
// to the customer's own-booking routes, which re-check the session
// and ownership server-side — the client never sends an email.
//
// Cancel is two-step: "Cancel" opens a confirm row ("Cancel this
// booking? Yes, cancel / Keep it"), so a stray click cannot cancel
// a booking. Reschedule opens a date input + time select (both
// labelled, keyboard-reachable): the date must be a future date
// (min = tomorrow) and the time is within opening hours 9 AM–6 PM,
// Mon–Sat — the same rules the server re-validates. After either
// action succeeds the page refreshes (router.refresh) so the new
// date / cancelled status shows immediately.
export default function BookingActions({
  id,
  status,
  appointmentAt,
}: {
  id: string;
  status: string;
  appointmentAt: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "reschedule" | "cancel">("none");
  // Today's date (UTC, matching the server validation). The
  // starting date is the booking's current date, but only if it is
  // still bookable (future, not a Sunday) — otherwise the customer
  // must pick a new one on the calendar.
  const todayStr = new Date().toISOString().slice(0, 10);
  const initialDate = appointmentAt ? appointmentAt.slice(0, 10) : "";
  const [date, setDate] = useState(
    initialDate && isBookableDate(initialDate, todayStr) ? initialDate : ""
  );
  const [time, setTime] = useState(
    appointmentAt ? appointmentAt.slice(11, 16) : "10:00"
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  if (status === "cancelled") return null;

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  async function cancelBooking() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/my-bookings/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsError(true);
        setMessage(data.error ?? "Could not cancel this booking.");
        return;
      }
      setIsError(false);
      setMessage("Booking cancelled.");
      setMode("none");
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("Could not cancel this booking. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleBooking(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/my-bookings/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsError(true);
        setMessage(data.error ?? "Could not reschedule this booking.");
        return;
      }
      setIsError(false);
      setMessage("Booking moved — the new date shows below.");
      setMode("none");
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("Could not reschedule this booking. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {mode === "none" && (
        <p>
          <button type="button" onClick={() => setMode("reschedule")}>
            Reschedule
          </button>{" "}
          <button type="button" onClick={() => setMode("cancel")}>
            Cancel
          </button>
        </p>
      )}
      {mode === "cancel" && (
        <div>
          <p>Cancel this booking?</p>
          <p>
            <button
              type="button"
              onClick={cancelBooking}
              disabled={busy}
            >
              {busy ? "Cancelling…" : "Yes, cancel"}
            </button>{" "}
            <button
              type="button"
              onClick={() => setMode("none")}
              disabled={busy}
            >
              Keep it
            </button>
          </p>
        </div>
      )}
      {mode === "reschedule" && (
        <form onSubmit={rescheduleBooking}>
          <div>
            <p>
              <strong>New date</strong>
            </p>
            {/* Month calendar (components/Calendar.tsx) instead of
                a plain date input: Sundays are closed and past
                dates cannot be picked; the server re-validates the
                same rules. The calendar opens on the booking's
                current month when a date is already set. */}
            <Calendar
              selected={date || null}
              onSelect={setDate}
              minDate={tomorrow}
              disableSundays
              initialMonth={date ? date.slice(0, 7) : undefined}
              ariaLabel="Pick a new date"
            />
            {date ? (
              <p>New date: {fmtDate(date)}</p>
            ) : (
              <p>Pick a date on the calendar above.</p>
            )}
          </div>
          <p>
            <label>
              New time
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              >
                {rescheduleTimeOptions().map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <small>
              Opening hours are 9:00 AM–6:00 PM, Monday–Saturday.
            </small>
          </p>
          <p>
            <button
              type="submit"
              disabled={busy || !date || !isBookableDate(date, todayStr)}
            >
              {busy ? "Moving…" : "Move booking"}
            </button>{" "}
            <button
              type="button"
              onClick={() => setMode("none")}
              disabled={busy}
            >
              Back
            </button>
          </p>
        </form>
      )}
      {message && (
        <p role={isError ? "alert" : "status"}>{message}</p>
      )}
    </div>
  );
}

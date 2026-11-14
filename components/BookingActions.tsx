"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/format";
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
  const [date, setDate] = useState(
    appointmentAt ? appointmentAt.slice(0, 10) : ""
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
          <p>
            <label>
              New date
              <input
                type="date"
                value={date}
                min={tomorrow}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
          </p>
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
            <button type="submit" disabled={busy}>
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

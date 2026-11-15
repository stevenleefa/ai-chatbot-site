// lib/daily-view.ts + components/DailyView.tsx — the homepage
// booking daily view. The diary is the real November 2026 diary
// (11 appointments), so the booked dates below are the real ones.
// Customer names from the diary (Grace Liu, Emma Thompson, …) must
// never appear in the visitor view — the projection carries no
// customer data at all, and these tests pin that.
import { render, screen, fireEvent } from "@testing-library/react";
import DailyView from "@/components/DailyView";
import {
  firstName,
  getDaySlots,
  type BookedAppointment,
} from "@/lib/daily-view";
import { APPOINTMENT_SLOTS, getAppointments } from "@/lib/customers";
import { getBookingStylists } from "@/lib/tools";

// The visitor-safe projection, exactly as app/page.tsx builds it:
// date/time/stylist only, no customer id or name.
function diaryProjection(): BookedAppointment[] {
  return getAppointments().map((a) => ({
    date: a.date,
    time: a.time,
    stylist: a.stylist,
  }));
}

const BOOKED = diaryProjection();
const SLOTS = APPOINTMENT_SLOTS;
const STYLISTS = getBookingStylists();

describe("getDaySlots", () => {
  it("marks a Sunday closed with no slots", () => {
    // 2026-11-15 and 2026-11-22 are Sundays.
    expect(getDaySlots("2026-11-15", BOOKED, SLOTS, STYLISTS)).toEqual({
      closed: true,
      slots: [],
    });
    expect(getDaySlots("2026-11-22", BOOKED, SLOTS, STYLISTS).closed).toBe(
      true
    );
  });

  it("marks a day with no bookings all free", () => {
    // Wednesday 2026-11-18 has no diary entry.
    const view = getDaySlots("2026-11-18", BOOKED, SLOTS, STYLISTS);
    expect(view.closed).toBe(false);
    expect(view.slots.map((s) => s.time)).toEqual(SLOTS);
    for (const s of view.slots) {
      expect(s.status).toBe("free");
      expect(s.bookedStylists).toEqual([]);
    }
  });

  it("marks booked slots partial with the stylist, the rest free", () => {
    // Saturday 2026-11-28: 09:00 Maya, 10:30 Sofia, 13:30 Maya.
    const view = getDaySlots("2026-11-28", BOOKED, SLOTS, STYLISTS);
    expect(view.closed).toBe(false);
    const byTime = new Map(view.slots.map((s) => [s.time, s]));
    expect(byTime.get("09:00")).toEqual({
      time: "09:00",
      bookedStylists: ["Maya Chen"],
      status: "partial",
    });
    expect(byTime.get("10:30")).toEqual({
      time: "10:30",
      bookedStylists: ["Sofia Reyes"],
      status: "partial",
    });
    expect(byTime.get("12:00")).toEqual({
      time: "12:00",
      bookedStylists: [],
      status: "free",
    });
    expect(byTime.get("13:30")).toEqual({
      time: "13:30",
      bookedStylists: ["Maya Chen"],
      status: "partial",
    });
    expect(byTime.get("15:00")?.status).toBe("free");
    expect(byTime.get("16:30")?.status).toBe("free");
  });

  it("marks a slot full only when every bookable stylist is booked", () => {
    // Synthetic: all four stylists booked at 09:00 on 2026-11-18.
    const booked: BookedAppointment[] = STYLISTS.map((stylist) => ({
      date: "2026-11-18",
      time: "09:00",
      stylist,
    }));
    const view = getDaySlots("2026-11-18", booked, SLOTS, STYLISTS);
    const slot = view.slots.find((s) => s.time === "09:00");
    expect(slot?.status).toBe("full");
    expect(slot?.bookedStylists).toEqual([...STYLISTS].sort());
    expect(view.slots.find((s) => s.time === "10:30")?.status).toBe("free");
  });

  it("shortens a stylist to their first name", () => {
    expect(firstName("Maya Chen")).toBe("Maya");
    expect(firstName("Sofia Reyes")).toBe("Sofia");
  });
});

describe("DailyView", () => {
  it("shows Closed on a Sunday with no bookable slots", () => {
    render(
      <DailyView
        date="2026-11-22"
        booked={BOOKED}
        slots={SLOTS}
        bookableStylists={STYLISTS}
        selectedTime={null}
        onSelectTime={() => {}}
      />
    );
    expect(screen.getByText(/Closed on Sundays/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /AM|PM/ })
    ).not.toBeInTheDocument();
  });

  it("shows the booked stylist on a busy slot and no customer name", () => {
    // 2026-11-28: Maya at 09:00 and 13:30, Sofia at 10:30. The
    // customers behind those bookings are Grace Liu and Emma
    // Thompson — their names must not appear anywhere.
    const { container } = render(
      <DailyView
        date="2026-11-28"
        booked={BOOKED}
        slots={SLOTS}
        bookableStylists={STYLISTS}
        selectedTime={null}
        onSelectTime={() => {}}
      />
    );
    expect(screen.getByText("Times on Nov 28, 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:00 AM, Maya booked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:30 AM, Sofia booked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1:30 PM, Maya booked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12:00 PM, available" })).toBeInTheDocument();
    // Busy slots stay tappable while another stylist is free.
    expect(screen.getByRole("button", { name: "9:00 AM, Maya booked" })).not.toBeDisabled();
    const text = container.textContent ?? "";
    for (const name of ["Grace", "Emma", "Liu", "Thompson"]) {
      expect(text).not.toContain(name);
    }
  });

  it("disables a fully booked slot and calls onSelectTime for a free one", () => {
    const onSelectTime = jest.fn();
    const booked: BookedAppointment[] = STYLISTS.map((stylist) => ({
      date: "2026-11-18",
      time: "09:00",
      stylist,
    }));
    render(
      <DailyView
        date="2026-11-18"
        booked={booked}
        slots={SLOTS}
        bookableStylists={STYLISTS}
        selectedTime={null}
        onSelectTime={onSelectTime}
      />
    );
    const full = screen.getByRole("button", { name: "9:00 AM, fully booked" });
    expect(full).toBeDisabled();
    expect(full).toHaveTextContent("Fully booked");
    const free = screen.getByRole("button", { name: "10:30 AM, available" });
    fireEvent.click(free);
    expect(onSelectTime).toHaveBeenCalledWith("10:30");
  });

  it("marks the selected time pressed and rose", () => {
    render(
      <DailyView
        date="2026-11-18"
        booked={BOOKED}
        slots={SLOTS}
        bookableStylists={STYLISTS}
        selectedTime="12:00"
        onSelectTime={() => {}}
      />
    );
    const selected = screen.getByRole("button", {
      name: "12:00 PM, available",
    });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveClass("daily-slot-selected");
    const other = screen.getByRole("button", { name: "9:00 AM, available" });
    expect(other).toHaveAttribute("aria-pressed", "false");
    expect(other).not.toHaveClass("daily-slot-selected");
  });
});

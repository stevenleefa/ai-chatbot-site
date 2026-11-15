// Daily view helpers — pure, client-safe. No server imports: the
// diary rows arrive as a visitor-safe projection (date/time/stylist
// only — never a customer name or id) from the server page, so a
// visitor can never see another customer's name here.
//
// A slot is "free" when no stylist is booked at that time, "partial"
// when some stylists are booked (still bookable — the visitor has
// not picked a stylist yet, so any free stylist can take it) and
// "full" when every bookable stylist is booked at that time. Sundays
// are closed, so a Sunday has no slots at all.
import { isSunday } from "@/lib/calendar";

// One diary row, projected for visitors: date, time and stylist
// only. The customer id and name never leave the server.
export type BookedAppointment = {
  date: string;
  time: string;
  stylist: string;
};

export type DaySlotStatus = "free" | "partial" | "full";

export type DaySlot = {
  time: string;
  // Full stylist names, e.g. "Maya Chen" — shown as first names in
  // the view ("Maya booked").
  bookedStylists: string[];
  status: DaySlotStatus;
};

export type DayView = {
  closed: boolean;
  slots: DaySlot[];
};

// "Maya Chen" -> "Maya". First names are how the salon talks about
// its stylists, and they keep the slot buttons compact.
export function firstName(fullName: string): string {
  return fullName.split(" ")[0];
}

// The slots for one day: each fixed slot with the stylists booked
// at that time. A Sunday is closed (no slots). `booked` is the
// visitor-safe projection for the whole diary; only rows for this
// date are used.
export function getDaySlots(
  date: string,
  booked: BookedAppointment[],
  slots: string[],
  bookableStylists: string[]
): DayView {
  if (isSunday(date)) return { closed: true, slots: [] };
  const todays = booked.filter((b) => b.date === date);
  const daySlots: DaySlot[] = slots.map((time) => {
    const bookedStylists = todays
      .filter((b) => b.time === time)
      .map((b) => b.stylist)
      .sort();
    const full =
      bookableStylists.length > 0 &&
      bookableStylists.every((s) => bookedStylists.includes(s));
    return {
      time,
      bookedStylists,
      status: full ? "full" : bookedStylists.length > 0 ? "partial" : "free",
    };
  });
  return { closed: false, slots: daySlots };
}

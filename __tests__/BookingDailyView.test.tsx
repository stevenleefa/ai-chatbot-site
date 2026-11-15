// components/HomeClient.tsx — the booking daily view integration:
// picking a date opens the daily view for that day, tapping a free
// slot fills the Date & time field, and the submitted lead carries
// the date and time. "Today" is pinned to Sunday 15 November 2026
// (fake timers, real setTimeout so waitFor still works) so the
// November diary dates are selectable — the calendar's minDate is
// tomorrow (Nov 16) and the diary covers November 2026 only.
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import HomeClient from "@/components/HomeClient";
import { defaultSettings } from "@/lib/site-settings";
import { APPOINTMENT_SLOTS, getAppointments } from "@/lib/customers";
import { getBookingStylists } from "@/lib/tools";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const SERVICES = [
  { name: "Haircut", price: "$35", time: "45 min", note: "A cut that fits real life." },
];

// The visitor-safe diary projection, exactly as app/page.tsx builds
// it: date/time/stylist only, no customer data.
function renderHome() {
  const bookedAppointments = getAppointments().map((a) => ({
    date: a.date,
    time: a.time,
    stylist: a.stylist,
  }));
  return render(
    <HomeClient
      settings={defaultSettings()}
      services={SERVICES}
      reviews={[]}
      ownerAppointmentsCard={null}
      bookedAppointments={bookedAppointments}
      bookableStylists={getBookingStylists()}
      appointmentSlots={APPOINTMENT_SLOTS}
    />
  );
}

function pickCalendarDay(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function dateTimeField(): HTMLInputElement {
  return screen.getByLabelText("Date & time") as HTMLInputElement;
}

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
    ],
  });
  jest.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Booking daily view", () => {
  it("opens the daily view when a date is picked, showing that day's slots", () => {
    renderHome();
    // No daily view before a date is picked.
    expect(screen.queryByText(/Times on/)).not.toBeInTheDocument();
    // Saturday 2026-11-28: three diary bookings.
    pickCalendarDay(/Saturday, November 28, 2026/);
    expect(screen.getByText("Times on Nov 28, 2026")).toBeInTheDocument();
    // All six fixed slots are shown.
    for (const label of [
      "9:00 AM, Maya booked",
      "10:30 AM, Sofia booked",
      "12:00 PM, available",
      "1:30 PM, Maya booked",
      "3:00 PM, available",
      "4:30 PM, available",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("shows the booked stylist on a busy slot and no customer name", () => {
    renderHome();
    pickCalendarDay(/Saturday, November 28, 2026/);
    const daily = screen.getByText("Times on Nov 28, 2026").closest(".daily-view") as HTMLElement;
    expect(daily).toBeInTheDocument();
    // Maya is booked at both 09:00 and 13:30, so her name shows twice.
    expect(within(daily).getAllByText("Maya booked")).toHaveLength(2);
    expect(within(daily).getByText("Sofia booked")).toBeInTheDocument();
    // The customers behind those bookings are Grace Liu and Emma
    // Thompson — their names must not appear in the daily view.
    const text = daily.textContent ?? "";
    for (const name of ["Grace", "Emma", "Liu", "Thompson"]) {
      expect(text).not.toContain(name);
    }
  });

  it("tapping a free slot fills the Date & time field", () => {
    renderHome();
    // Wednesday 2026-11-18 has no bookings — every slot is free.
    pickCalendarDay(/Wednesday, November 18, 2026/);
    expect(dateTimeField()).toHaveValue("Nov 18, 2026");
    fireEvent.click(screen.getByRole("button", { name: "9:00 AM, available" }));
    expect(dateTimeField()).toHaveValue("Nov 18, 2026, 9:00 AM");
    expect(
      screen.getByRole("button", { name: "9:00 AM, available" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("picking a different date updates the daily view and clears the old time", () => {
    renderHome();
    pickCalendarDay(/Saturday, November 28, 2026/);
    fireEvent.click(screen.getByRole("button", { name: "12:00 PM, available" }));
    expect(dateTimeField()).toHaveValue("Nov 28, 2026, 12:00 PM");
    // Tuesday 2026-11-17: only 16:30 is booked (Amelia).
    pickCalendarDay(/Tuesday, November 17, 2026/);
    expect(screen.getByText("Times on Nov 17, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Times on Nov 28, 2026")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4:30 PM, Amelia booked" })).toBeInTheDocument();
    // The old time is gone; only the new date shows.
    expect(dateTimeField()).toHaveValue("Nov 17, 2026");
  });

  it("sends the picked date and time with the booking request", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: "Thanks — request received." }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = renderHome();
    const bookingForm = container.querySelector("#booking .lead-form") as HTMLElement;
    fireEvent.change(within(bookingForm).getByPlaceholderText("Your name"), {
      target: { value: "Test Person" },
    });
    fireEvent.change(within(bookingForm).getByPlaceholderText("Phone or email"), {
      target: { value: "test@example.com" },
    });
    pickCalendarDay(/Wednesday, November 18, 2026/);
    fireEvent.click(screen.getByRole("button", { name: "9:00 AM, available" }));
    fireEvent.click(screen.getByRole("button", { name: "Request booking" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.message).toMatch(/Preferred date: Nov 18, 2026, 9:00 AM\./);
  });

  it("sends just the date when no time is picked", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: "Thanks — request received." }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = renderHome();
    const bookingForm = container.querySelector("#booking .lead-form") as HTMLElement;
    fireEvent.change(within(bookingForm).getByPlaceholderText("Your name"), {
      target: { value: "Test Person" },
    });
    fireEvent.change(within(bookingForm).getByPlaceholderText("Phone or email"), {
      target: { value: "test@example.com" },
    });
    pickCalendarDay(/Wednesday, November 18, 2026/);
    fireEvent.click(screen.getByRole("button", { name: "Request booking" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.message).toMatch(/Preferred date: Nov 18, 2026\./);
    expect(body.message).not.toMatch(/AM|PM/);
  });
});

// components/Calendar.tsx — the reusable month calendar used by
// the booking form, the reschedule control, and the owner month
// view. These tests pin the calendar to Friday 13 November 2026
// (via the `today` prop) so the month, the window, and the
// disabled days are deterministic — the real component uses the
// actual current date.
import { render, screen, fireEvent } from "@testing-library/react";
import Calendar from "@/components/Calendar";

// Friday 13 November 2026. November 2026 has 30 days, 1 November
// is a Sunday, and the Sundays are 1, 8, 15, 22 and 29.
const TODAY = "2026-11-13";

function dayButton(label: string) {
  return screen.getByRole("button", { name: new RegExp(label) });
}

describe("Calendar — month grid", () => {
  it("renders the current month as a heading", () => {
    render(<Calendar today={TODAY} />);
    expect(
      screen.getByRole("heading", { name: "November 2026" })
    ).toBeInTheDocument();
  });

  it("renders all 30 days of November 2026 as buttons, with 5 blank cells", () => {
    const { container } = render(<Calendar today={TODAY} />);
    expect(container.querySelectorAll(".cal-day").length).toBe(30);
    expect(container.querySelectorAll(".cal-blank").length).toBe(5);
  });

  it("renders a weekday header, Sunday to Saturday", () => {
    const { container } = render(<Calendar today={TODAY} />);
    const headers = Array.from(
      container.querySelectorAll(".cal-weekday")
    ).map((el) => el.textContent);
    expect(headers).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("highlights today", () => {
    render(<Calendar today={TODAY} />);
    expect(dayButton("Friday, November 13, 2026")).toHaveClass("cal-day-today");
  });

  it("labels each day button with its full date", () => {
    render(<Calendar today={TODAY} />);
    expect(dayButton("Wednesday, November 18, 2026")).toBeInTheDocument();
  });
});

describe("Calendar — Sundays and past dates", () => {
  it("marks Sundays as closed and disables them for booking", () => {
    render(<Calendar today={TODAY} disableSundays />);
    for (const day of [1, 8, 15, 22, 29]) {
      const button = screen.getByRole("button", {
        name: new RegExp(`November ${day}, 2026, Closed`),
      });
      expect(button).toBeDisabled();
      expect(button).toHaveClass("cal-day-closed");
    }
    // A weekday is not closed.
    expect(
      dayButton("Wednesday, November 18, 2026")
    ).not.toHaveClass("cal-day-closed");
  });

  it("disables past dates when disablePast is set", () => {
    render(<Calendar today={TODAY} disablePast />);
    expect(dayButton("Thursday, November 12, 2026")).toBeDisabled();
    expect(dayButton("Friday, November 13, 2026")).not.toBeDisabled();
  });

  it("disables dates before minDate", () => {
    render(<Calendar today={TODAY} minDate="2026-11-14" />);
    expect(dayButton("Friday, November 13, 2026")).toBeDisabled();
    expect(dayButton("Saturday, November 14, 2026")).not.toBeDisabled();
  });

  it("does not disable Sundays when disableSundays is off (owner view)", () => {
    render(<Calendar today={TODAY} />);
    expect(
      screen.getByRole("button", {
        name: /Sunday, November 15, 2026, Closed/,
      })
    ).not.toBeDisabled();
  });
});

describe("Calendar — selection", () => {
  it("calls onSelect with the ISO date when a day is tapped", () => {
    const onSelect = jest.fn();
    render(<Calendar today={TODAY} onSelect={onSelect} />);
    fireEvent.click(dayButton("Wednesday, November 18, 2026"));
    expect(onSelect).toHaveBeenCalledWith("2026-11-18");
  });

  it("does not call onSelect for a disabled day", () => {
    const onSelect = jest.fn();
    render(<Calendar today={TODAY} disableSundays onSelect={onSelect} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Sunday, November 15, 2026, Closed/,
      })
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the selected day and announces it", () => {
    render(<Calendar today={TODAY} selected="2026-11-18" />);
    const button = screen.getByRole("button", {
      name: /Wednesday, November 18, 2026, Selected/,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("cal-day-selected");
  });

  it("shows an appointment count on days that have bookings", () => {
    render(
      <Calendar
        today={TODAY}
        appointmentCounts={{ "2026-11-28": 3, "2026-11-12": 1 }}
      />
    );
    expect(
      screen.getByRole("button", {
        name: /Saturday, November 28, 2026, 3 appointments/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Thursday, November 12, 2026, 1 appointment/,
      })
    ).toBeInTheDocument();
    // A day with no appointments has no count in its label.
    expect(
      dayButton("Wednesday, November 18, 2026")
    ).not.toHaveTextContent("appointment");
  });
});

describe("Calendar — navigation and the one-year window", () => {
  it("moves to the previous and next month", () => {
    render(<Calendar today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen.getByRole("heading", { name: "December 2026" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(
      screen.getByRole("heading", { name: "October 2026" })
    ).toBeInTheDocument();
  });

  it("disables Previous at the earliest month (one year back)", () => {
    render(<Calendar today={TODAY} initialMonth="2025-11" />);
    expect(
      screen.getByRole("heading", { name: "November 2025" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Previous month" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next month" })
    ).not.toBeDisabled();
  });

  it("disables Next at the latest month (one year forward)", () => {
    render(<Calendar today={TODAY} initialMonth="2027-11" />);
    expect(
      screen.getByRole("heading", { name: "November 2027" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next month" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Previous month" })
    ).not.toBeDisabled();
  });

  it("jumps back to the current month with Today", () => {
    render(<Calendar today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen.getByRole("heading", { name: "January 2027" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(
      screen.getByRole("heading", { name: "November 2026" })
    ).toBeInTheDocument();
  });

  it("opens on initialMonth when one is given", () => {
    render(<Calendar today={TODAY} initialMonth="2026-12" />);
    expect(
      screen.getByRole("heading", { name: "December 2026" })
    ).toBeInTheDocument();
  });

  it("clamps initialMonth into the one-year window", () => {
    render(<Calendar today={TODAY} initialMonth="2030-06" />);
    expect(
      screen.getByRole("heading", { name: "November 2027" })
    ).toBeInTheDocument();
  });
});

describe("Calendar — keyboard and announcements", () => {
  it("renders days as real buttons (Tab reaches them, Enter/Space selects)", () => {
    const { container } = render(<Calendar today={TODAY} />);
    const days = container.querySelectorAll(".cal-day");
    expect(days.length).toBeGreaterThan(0);
    for (const day of Array.from(days)) {
      expect(day.tagName).toBe("BUTTON");
    }
  });

  it("announces the month heading (aria-live)", () => {
    const { container } = render(<Calendar today={TODAY} />);
    expect(container.querySelector(".cal-heading")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("labels the calendar region", () => {
    render(<Calendar today={TODAY} ariaLabel="Pick a preferred date" />);
    expect(
      screen.getByRole("group", { name: "Pick a preferred date" })
    ).toBeInTheDocument();
  });
});

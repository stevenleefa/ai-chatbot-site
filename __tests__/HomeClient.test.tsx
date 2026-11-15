// components/HomeClient.tsx — the homepage booking + review layout,
// after the calendar fix (2026-11-14): the booking and review cards
// are stacked (booking on top, review underneath), the booking card
// is full width, and inside it the fields sit on the left and the
// Preferred date calendar on the right. These tests pin the layout
// structure and the date -> booking-request wiring, plus the CSS
// rules that make the layout work. jsdom does not apply external
// stylesheets, so the layout rules are asserted on the stylesheet
// text (helpers globalsCss() / calendarCss() / ruleHas() read the
// files), as the FavoriteProducts layout tests do.
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import HomeClient from "@/components/HomeClient";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import { defaultSettings } from "@/lib/site-settings";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function globalsCss(): string {
  return readFileSync(join(__dirname, "../app/globals.css"), "utf8");
}

function calendarCss(): string {
  return readFileSync(join(__dirname, "../components/Calendar.css"), "utf8");
}

// True when the rule block for `selector` contains `declaration`
// (whitespace-insensitive).
function ruleHas(css: string, selector: string, declaration: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) return false;
  const block = match[1].replace(/\s+/g, " ");
  return block.includes(declaration);
}

const SERVICES = [
  { name: "Haircut", price: "$35", time: "45 min", note: "A cut that fits real life." },
];

function renderHome() {
  return render(
    <HomeClient
      settings={defaultSettings()}
      services={SERVICES}
      reviews={[]}
      ownerAppointmentsCard={null}
    />
  );
}

// Click the first selectable day on the booking calendar. If the
// current month has no selectable day left (today is the last day
// of the month, so minDate is next month), go to the next month
// first and pick there.
function pickFirstSelectableDay(container: HTMLElement) {
  const enabled = () =>
    Array.from(
      container.querySelectorAll(".booking-calendar .cal-day:not(:disabled)")
    ) as HTMLElement[];
  let days = enabled();
  if (days.length === 0) {
    fireEvent.click(
      screen.getByRole("button", { name: "Next month" })
    );
    days = enabled();
  }
  expect(days.length).toBeGreaterThan(0);
  fireEvent.click(days[0]);
}

describe("HomeClient — stacked booking and review cards", () => {
  it("renders the booking section before the review form (booking on top)", () => {
    renderHome();
    const booking = screen.getByRole("heading", { name: "Book an appointment" });
    const review = screen.getByRole("heading", { name: "Leave a review" });
    expect(
      booking.compareDocumentPosition(review) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("puts the booking fields and the calendar side by side inside the booking form", () => {
    const { container } = renderHome();
    const form = container.querySelector("#booking .lead-form") as HTMLElement;
    expect(form).toBeInTheDocument();
    const grid = form.querySelector(".booking-form-grid") as HTMLElement;
    expect(grid).toBeInTheDocument();
    const fields = grid.querySelector(".booking-fields") as HTMLElement;
    const calendar = grid.querySelector(".booking-calendar") as HTMLElement;
    expect(fields).toBeInTheDocument();
    expect(calendar).toBeInTheDocument();
    // Fields first, calendar second.
    expect(
      fields.compareDocumentPosition(calendar) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // The four fields live in the left column.
    expect(fields.querySelector('input[placeholder="Your name"]')).toBeInTheDocument();
    expect(fields.querySelector("select")).toBeInTheDocument();
    expect(fields.querySelector("textarea")).toBeInTheDocument();
    expect(fields.querySelector('input[placeholder="Phone or email"]')).toBeInTheDocument();
    // The calendar and its picked-date line live in the right column.
    expect(
      calendar.querySelector('[role="group"][aria-label="Pick a preferred date"]')
    ).toBeInTheDocument();
    expect(calendar.querySelector(".calendar")).toBeInTheDocument();
    expect(screen.getByText("No date picked yet — optional.")).toBeInTheDocument();
  });

  it("keeps the calendar's nav row above its date grid (not side by side)", () => {
    const { container } = renderHome();
    const calendar = container.querySelector(
      ".booking-calendar .calendar"
    ) as HTMLElement;
    expect(calendar).toBeInTheDocument();
    expect(calendar.children[0]).toHaveClass("cal-nav");
    expect(calendar.children[1]).toHaveClass("cal-grid");
    // All seven weekday headers, Sunday to Saturday, fully present.
    const headers = Array.from(
      calendar.querySelectorAll(".cal-weekday")
    ).map((el) => el.textContent);
    expect(headers).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("keeps each submit button in its own card", () => {
    const { container } = renderHome();
    const bookingForm = container.querySelector("#booking .lead-form") as HTMLElement;
    const reviewForm = container.querySelector(".review-form") as HTMLElement;
    expect(
      bookingForm.querySelector('button[type="submit"]')?.textContent
    ).toBe("Request booking");
    expect(
      reviewForm.querySelector('button[type="submit"]')?.textContent
    ).toBe("Submit review");
  });

  it("still sends the picked date with the booking request", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: "Thanks — request received." }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = renderHome();
    // Scope to the booking form: the review form below has its own
    // "Your name" field with the same placeholder.
    const bookingForm = container.querySelector("#booking .lead-form") as HTMLElement;
    fireEvent.change(within(bookingForm).getByPlaceholderText("Your name"), {
      target: { value: "Test Person" },
    });
    fireEvent.change(within(bookingForm).getByPlaceholderText("Phone or email"), {
      target: { value: "test@example.com" },
    });
    pickFirstSelectableDay(container);
    expect(screen.getByText(/Preferred date:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request booking" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.message).toMatch(/Preferred date: /);
  });
});

describe("HomeClient — layout CSS", () => {
  it("stacks the booking and review cards in one column", () => {
    const css = globalsCss();
    expect(ruleHas(css, ".booking-review-row", "grid-template-columns: 1fr;")).toBe(true);
    expect(css).not.toMatch(/\.booking-review-row\s*\{[^}]*1fr 1fr/);
  });

  it("gives the booking form a fields-left / calendar-right grid with a wide gap", () => {
    const css = globalsCss();
    expect(
      ruleHas(
        css,
        ".booking-form-grid",
        "grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);"
      )
    ).toBe(true);
    expect(ruleHas(css, ".booking-form-grid", "48px")).toBe(true);
    // The grid stacks on narrow screens so the calendar keeps its width.
    expect(css).toMatch(
      /@media \(max-width: 900px\) \{\s*\.booking-form-grid \{ grid-template-columns: 1fr; \}\s*\}/
    );
  });

  it("lets the booking and review forms use the full card width", () => {
    const css = globalsCss();
    expect(
      ruleHas(
        css,
        ".booking-card .lead-form, .review-card .lead-form",
        "max-width: none;"
      )
    ).toBe(true);
  });

  it("does not give the shared calendar a 7-column grid (the old collision)", () => {
    const css = globalsCss();
    // The legacy 7-column grid now belongs to .appt-calendar only.
    expect(ruleHas(css, ".appt-calendar", "grid-template-columns: repeat(7, 1fr);")).toBe(true);
    expect(css).not.toMatch(/\.calendar\s*\{[^}]*display: grid/);
    // The shared calendar's day buttons are not restyled by the
    // legacy day-number rule either.
    expect(css).not.toMatch(/^\.cal-day \{/m);
    expect(ruleHas(css, ".cal-cell .cal-day", "font-weight: 700;")).toBe(true);
  });

  it("keeps the shared calendar a plain block with its nav above its grid", () => {
    const css = calendarCss();
    expect(ruleHas(css, ".calendar", "display: block;")).toBe(true);
    expect(ruleHas(css, ".cal-grid .cal-day", "display: flex;")).toBe(true);
  });
});

describe("AppointmentCalendar — still a 7-column grid under its own class", () => {
  it("renders the month grid as .appt-calendar, not .calendar", () => {
    const { container } = render(
      <AppointmentCalendar appointments={[]} view="month" anchorDate="2026-11-13" />
    );
    expect(container.querySelector(".appt-calendar")).toBeInTheDocument();
    expect(container.querySelector(".calendar")).toBeNull();
    // November 2026: 7 weekday headers, 35 cells (30 days, Sundays
    // included — November 1 is a Sunday so no leading blanks).
    expect(container.querySelectorAll(".cal-head").length).toBe(7);
    expect(container.querySelectorAll(".cal-cell").length).toBe(35);
  });
});

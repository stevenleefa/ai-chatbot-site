// lib/calendar.ts — the month math behind the reusable month
// calendar (components/Calendar.tsx). All arithmetic is UTC-based
// (Date.UTC) so the grid never shifts with the viewer's timezone,
// and it covers month lengths, leap years, first-day-of-week
// alignment, the ±1-year navigation window, and the booking rules
// (future date, not a Sunday).
import {
  addMonths,
  clampMonth,
  daysInMonth,
  firstWeekday,
  formatDayLong,
  isBookableDate,
  isSunday,
  monthGrid,
  monthLabel,
  monthWindow,
  parseISODate,
  toISODate,
  todayISO,
  weekdayOf,
} from "@/lib/calendar";

describe("daysInMonth", () => {
  it("returns 30 for November and 31 for January", () => {
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it("returns 28 for February in a common year", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("returns 29 for February in a leap year", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it("returns 28 for February in a century non-leap year", () => {
    expect(daysInMonth(2100, 2)).toBe(28);
  });

  it("returns 30 for April, June, September and November", () => {
    for (const month of [4, 6, 9, 11]) {
      expect(daysInMonth(2026, month)).toBe(30);
    }
  });
});

describe("firstWeekday", () => {
  it("returns 0 for November 2026 (1 November is a Sunday)", () => {
    expect(firstWeekday(2026, 11)).toBe(0);
  });

  it("returns 4 for January 2026 (1 January is a Thursday)", () => {
    expect(firstWeekday(2026, 1)).toBe(4);
  });

  it("returns 2 for December 2026 (1 December is a Tuesday)", () => {
    expect(firstWeekday(2026, 12)).toBe(2);
  });
});

describe("addMonths", () => {
  it("steps forward within a year", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
  });

  it("steps backward across a year boundary", () => {
    expect(addMonths("2026-11", -1)).toBe("2026-10");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("steps a full year either way", () => {
    expect(addMonths("2026-11", 12)).toBe("2027-11");
    expect(addMonths("2026-11", -12)).toBe("2025-11");
  });

  it("leaves the month unchanged for 0", () => {
    expect(addMonths("2026-11", 0)).toBe("2026-11");
  });
});

describe("monthLabel", () => {
  it("labels November 2026", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
  });

  it("labels January 2027", () => {
    expect(monthLabel("2027-01")).toBe("January 2027");
  });
});

describe("monthWindow", () => {
  it("allows one year back and one year forward from the current month", () => {
    expect(monthWindow("2026-11-13")).toEqual({
      minMonth: "2025-11",
      maxMonth: "2027-11",
    });
  });

  it("anchors on the month, not the day", () => {
    expect(monthWindow("2026-11-01")).toEqual({
      minMonth: "2025-11",
      maxMonth: "2027-11",
    });
  });
});

describe("clampMonth", () => {
  it("clamps below the earliest month", () => {
    expect(clampMonth("2025-10", "2025-11", "2027-11")).toBe("2025-11");
  });

  it("clamps above the latest month", () => {
    expect(clampMonth("2028-01", "2025-11", "2027-11")).toBe("2027-11");
  });

  it("leaves a month inside the window unchanged", () => {
    expect(clampMonth("2026-06", "2025-11", "2027-11")).toBe("2026-06");
  });
});

describe("monthGrid", () => {
  it("lays out November 2026 starting on a Sunday, with trailing blanks", () => {
    const grid = monthGrid(2026, 11);
    // 30 days starting on Sunday -> 5 rows (35 cells), 5 blanks
    // at the end.
    expect(grid.length).toBe(35);
    expect(grid[0]).toEqual({ iso: "2026-11-01", day: 1 });
    expect(grid[29]).toEqual({ iso: "2026-11-30", day: 30 });
    expect(grid.slice(30)).toEqual([null, null, null, null, null]);
  });

  it("lays out February 2026 with no blanks (28 days from a Sunday)", () => {
    const grid = monthGrid(2026, 2);
    expect(grid.length).toBe(28);
    expect(grid[0]).toEqual({ iso: "2026-02-01", day: 1 });
    expect(grid[27]).toEqual({ iso: "2026-02-28", day: 28 });
    expect(grid.every((c) => c !== null)).toBe(true);
  });

  it("lays out December 2026 with leading and trailing blanks", () => {
    const grid = monthGrid(2026, 12);
    // 1 December is a Tuesday -> 2 leading blanks, 31 days,
    // 2 trailing blanks = 35 cells.
    expect(grid.length).toBe(35);
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBeNull();
    expect(grid[2]).toEqual({ iso: "2026-12-01", day: 1 });
    expect(grid[32]).toEqual({ iso: "2026-12-31", day: 31 });
    expect(grid[33]).toBeNull();
    expect(grid[34]).toBeNull();
  });

  it("lays out February 2024 with 29 days (leap year)", () => {
    const grid = monthGrid(2024, 2);
    // 1 February 2024 is a Thursday -> 4 leading blanks, 29
    // days, 2 trailing blanks = 35 cells.
    expect(grid.length).toBe(35);
    expect(grid.filter((c) => c !== null).length).toBe(29);
    expect(grid[4]).toEqual({ iso: "2024-02-01", day: 1 });
    expect(grid[32]).toEqual({ iso: "2024-02-29", day: 29 });
  });

  it("never drops a day: the day cells are consecutive 1..N", () => {
    const grid = monthGrid(2026, 3);
    const days = grid.filter((c) => c !== null).map((c) => c!.day);
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });
});

describe("toISODate / parseISODate", () => {
  it("formats a year/month/day as an ISO date", () => {
    expect(toISODate(2026, 11, 18)).toBe("2026-11-18");
    expect(toISODate(2026, 1, 5)).toBe("2026-01-05");
  });

  it("parses an ISO date back to its parts", () => {
    expect(parseISODate("2026-11-18")).toEqual({
      year: 2026,
      month: 11,
      day: 18,
    });
  });

  it("round-trips through monthGrid", () => {
    const grid = monthGrid(2026, 11);
    const cell = grid[17];
    expect(cell).not.toBeNull();
    expect(parseISODate(cell!.iso)).toEqual({
      year: 2026,
      month: 11,
      day: 18,
    });
  });
});

describe("todayISO", () => {
  it("formats a Date as its UTC date", () => {
    expect(todayISO(new Date("2026-11-13T12:00:00Z"))).toBe("2026-11-13");
  });
});

describe("weekdayOf / isSunday / formatDayLong", () => {
  it("knows 15 November 2026 is a Sunday", () => {
    expect(weekdayOf("2026-11-15")).toBe(0);
    expect(isSunday("2026-11-15")).toBe(true);
  });

  it("knows 18 November 2026 is a Wednesday", () => {
    expect(weekdayOf("2026-11-18")).toBe(3);
    expect(isSunday("2026-11-18")).toBe(false);
  });

  it("formats a full day name", () => {
    expect(formatDayLong("2026-11-18")).toBe("Wednesday, November 18, 2026");
    expect(formatDayLong("2026-11-15")).toBe("Sunday, November 15, 2026");
  });
});

describe("isBookableDate", () => {
  // Today is Friday 13 November 2026.
  const today = "2026-11-13";

  it("allows a future Saturday and a future Monday", () => {
    expect(isBookableDate("2026-11-14", today)).toBe(true);
    expect(isBookableDate("2026-11-16", today)).toBe(true);
  });

  it("rejects today and any past date", () => {
    expect(isBookableDate("2026-11-13", today)).toBe(false);
    expect(isBookableDate("2026-11-12", today)).toBe(false);
  });

  it("rejects Sundays even when they are in the future", () => {
    expect(isBookableDate("2026-11-15", today)).toBe(false);
    expect(isBookableDate("2026-11-22", today)).toBe(false);
  });

  it("rejects impossible or malformed dates", () => {
    expect(isBookableDate("2026-02-30", today)).toBe(false);
    expect(isBookableDate("not-a-date", today)).toBe(false);
    expect(isBookableDate("", today)).toBe(false);
  });
});

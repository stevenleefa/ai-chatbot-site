// lib/format.ts — display helpers. formatTime is the 12-hour clock
// the appointments pages use; stored times stay "HH:MM" and must
// never be shown as military time.
import { formatTime, fmtDate } from "@/lib/format";

describe("formatTime (12-hour, never military)", () => {
  it.each([
    ["09:00", "9:00 AM"],
    ["10:30", "10:30 AM"],
    ["12:00", "12:00 PM"],
    ["13:30", "1:30 PM"],
    ["15:00", "3:00 PM"],
    ["16:30", "4:30 PM"],
    ["18:00", "6:00 PM"],
    ["00:00", "12:00 AM"],
    ["00:30", "12:30 AM"],
    ["23:59", "11:59 PM"],
  ])("%s -> %s", (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });

  it("never outputs a 24-hour hour (13-23) or 00", () => {
    for (let h = 0; h < 24; h++) {
      const out = formatTime(`${String(h).padStart(2, "0")}:00`);
      expect(out).not.toMatch(/^(1[3-9]|2[0-3]|0\d):/);
    }
  });
});

describe("fmtDate", () => {
  it("formats an ISO date as 'Nov 12, 2026'", () => {
    expect(fmtDate("2026-11-12")).toBe("Nov 12, 2026");
    expect(fmtDate("2026-01-05")).toBe("Jan 5, 2026");
  });
});

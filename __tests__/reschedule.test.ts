// lib/reschedule.ts — reschedule validation. "Today" is fixed via
// the `now` argument (2026-11-13, a Friday), so the future-date
// cases do not depend on when the suite runs.
import { validateReschedule, rescheduleTimeOptions } from "@/lib/reschedule";

// 2026-11-13 is a Friday.
const NOW = new Date("2026-11-13T12:00:00Z");

describe("validateReschedule", () => {
  it("accepts a future Monday–Saturday date within 09:00–18:00", () => {
    expect(validateReschedule("2026-11-14", "10:00", NOW)).toEqual({
      ok: true,
      appointmentAt: "2026-11-14T10:00:00.000Z",
    });
    expect(validateReschedule("2026-11-16", "09:00", NOW).ok).toBe(true);
    expect(validateReschedule("2026-11-16", "18:00", NOW).ok).toBe(true);
  });

  it("rejects today and past dates", () => {
    expect(validateReschedule("2026-11-13", "10:00", NOW)).toEqual({
      ok: false,
      error: expect.stringContaining("future date"),
    });
    expect(validateReschedule("2026-11-12", "10:00", NOW).ok).toBe(false);
  });

  it("rejects Sundays — the studio is closed", () => {
    // 2026-11-15 is a Sunday.
    const result = validateReschedule("2026-11-15", "10:00", NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Sunday/i);
    }
  });

  it("rejects times outside opening hours 09:00–18:00", () => {
    expect(validateReschedule("2026-11-16", "08:59", NOW).ok).toBe(false);
    expect(validateReschedule("2026-11-16", "08:00", NOW).ok).toBe(false);
    expect(validateReschedule("2026-11-16", "18:30", NOW).ok).toBe(false);
    expect(validateReschedule("2026-11-16", "19:00", NOW).ok).toBe(false);
  });

  it("rejects malformed dates and times", () => {
    expect(validateReschedule("2026-02-30", "10:00", NOW).ok).toBe(false);
    expect(validateReschedule("16/11/2026", "10:00", NOW).ok).toBe(false);
    expect(validateReschedule("2026-11-16", "10", NOW).ok).toBe(false);
    expect(validateReschedule("2026-11-16", "25:00", NOW).ok).toBe(false);
    expect(validateReschedule(null, "10:00", NOW).ok).toBe(false);
    expect(validateReschedule("2026-11-16", undefined, NOW).ok).toBe(false);
  });
});

describe("rescheduleTimeOptions", () => {
  it("runs every 30 minutes from 09:00 to 18:00 inclusive", () => {
    const options = rescheduleTimeOptions();
    expect(options[0]).toBe("09:00");
    expect(options[options.length - 1]).toBe("18:00");
    expect(options).toHaveLength(19);
    expect(options).toContain("09:30");
    expect(options).toContain("12:30");
  });
});

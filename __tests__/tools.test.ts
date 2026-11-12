// Assistant tools tests (lib/tools.ts). Pure dispatch and
// validation — no network, no Supabase: in this environment the
// lead save runs in demo mode (saved:false), which the booking
// tests assert honestly instead of pretending a save happened.
import {
  actionToText,
  createBooking,
  dispatchTool,
  getAvailability,
  getBookingStylists,
  getServices,
  OPENAI_TOOL_DEFS,
} from "@/lib/tools";

describe("getServices", () => {
  it("returns the four services with exact prices from lib/business.ts", () => {
    const data = getServices();
    expect(data.services).toHaveLength(4);
    expect(data.services[0]).toEqual(
      expect.objectContaining({ name: "Haircut", price: "$35" })
    );
    expect(data.services.map((s) => s.name)).toEqual([
      "Haircut",
      "Full colour",
      "Balayage",
      "Beard trim",
    ]);
  });
});

describe("getBookingStylists", () => {
  it("is the four diary stylists, not the receptionist", () => {
    expect(getBookingStylists()).toEqual([
      "Amelia Brooks",
      "Jordan Lee",
      "Maya Chen",
      "Sofia Reyes",
    ]);
  });
});

describe("getAvailability", () => {
  it("lists free slots per stylist for a Saturday in the diary", () => {
    const action = getAvailability({ date: "2026-11-14" });
    expect(action.type).toBe("availability");
    if (action.type === "availability") {
      expect(action.dayLabel).toBe("Saturday Nov 14");
      // Jordan has the 12:00 beard trim that day; everyone else is free.
      const jordan = action.free.find((f) => f.stylist === "Jordan Lee")!;
      expect(jordan.times).not.toContain("12:00");
      expect(jordan.times).toContain("10:30");
      const amelia = action.free.find((f) => f.stylist === "Amelia Brooks")!;
      expect(amelia.times).toHaveLength(6);
    }
  });

  it("refuses Sundays (closed) and dates outside November", () => {
    expect(getAvailability({ date: "2026-11-01" })).toEqual(
      expect.objectContaining({
        type: "availability_failed",
        reason: expect.stringContaining("closed on Sundays"),
      })
    );
    expect(getAvailability({ date: "2026-12-05" })).toEqual(
      expect.objectContaining({ type: "availability_failed" })
    );
  });

  it("rejects an unknown stylist, and Priya with an honest reason", () => {
    expect(getAvailability({ date: "2026-11-14", stylist: "Nobody" })).toEqual(
      expect.objectContaining({ type: "availability_failed" })
    );
    const priya = getAvailability({ date: "2026-11-14", stylist: "Priya" });
    expect(priya).toEqual(
      expect.objectContaining({
        type: "availability_failed",
        reason: expect.stringContaining("receptionist"),
      })
    );
  });
});

describe("createBooking", () => {
  const valid = {
    service: "Haircut",
    name: "Emma Thompson",
    contact: "(555) 014-2201",
    date: "2026-11-14",
    time: "10:30",
  };

  it("creates a booking in demo mode and reports saved:false honestly", async () => {
    const action = await createBooking(valid);
    expect(action).toEqual({
      type: "booking_created",
      service: "Haircut",
      date: "2026-11-14",
      time: "10:30",
      stylist: "Amelia Brooks", // first alphabetical stylist free then
      saved: false,
      duplicate: undefined,
    });
  });

  it("rejects an unknown service, a Sunday, and a non-slot time", async () => {
    expect(await createBooking({ ...valid, service: "Perm" })).toEqual(
      expect.objectContaining({ type: "booking_failed" })
    );
    expect(await createBooking({ ...valid, date: "2026-11-01" })).toEqual(
      expect.objectContaining({
        type: "booking_failed",
        reason: expect.stringContaining("closed on Sundays"),
      })
    );
    expect(await createBooking({ ...valid, time: "11:00" })).toEqual(
      expect.objectContaining({
        type: "booking_failed",
        reason: expect.stringContaining("half-hour slots"),
      })
    );
  });

  it("refuses a slot the stylist already has, and names who is free", async () => {
    const action = await createBooking({
      ...valid,
      service: "Beard trim",
      stylist: "Jordan Lee",
      time: "12:00",
    });
    expect(action).toEqual(
      expect.objectContaining({
        type: "booking_failed",
        reason: expect.stringContaining("Jordan Lee is already booked"),
      })
    );
    expect((action as { reason: string }).reason).toContain("free then");
  });

  it("refuses Priya (receptionist) as a stylist", async () => {
    expect(
      await createBooking({ ...valid, stylist: "Priya Nair" })
    ).toEqual(
      expect.objectContaining({
        type: "booking_failed",
        reason: expect.stringContaining("receptionist"),
      })
    );
  });

  it("needs a reachable contact", async () => {
    expect(await createBooking({ ...valid, contact: "nope" })).toEqual(
      expect.objectContaining({ type: "booking_failed" })
    );
  });
});

describe("dispatchTool", () => {
  it("routes getServices and unknown tools", async () => {
    const services = await dispatchTool("getServices", {});
    expect(services.action.type).toBe("services");
    expect(services.summary).toContain("Haircut $35");
    const unknown = await dispatchTool("sendEmail", {});
    expect(unknown.action.type).toBe("booking_failed");
  });

  it("exposes exactly three OpenAI function definitions", () => {
    expect(OPENAI_TOOL_DEFS.map((d) => d.function.name)).toEqual([
      "getServices",
      "getAvailability",
      "createBooking",
    ]);
    const booking = OPENAI_TOOL_DEFS.find(
      (d) => d.function.name === "createBooking"
    )!;
    expect(booking.function.parameters.required).toEqual([
      "service",
      "name",
      "contact",
    ]);
  });
});

describe("actionToText", () => {
  it("renders a booking confirmation with the demo-mode note", () => {
    expect(
      actionToText({
        type: "booking_created",
        service: "Haircut",
        date: "2026-11-14",
        time: "10:30",
        stylist: "Amelia Brooks",
        saved: false,
      })
    ).toContain("not saved yet");
  });
});

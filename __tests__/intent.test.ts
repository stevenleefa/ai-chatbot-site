// Intent parser tests (lib/intent.ts). Free mode's understanding
// is deterministic regexes, so every parse is reproducible here.
// The two guard cases matter most: "How do I book an appointment?"
// must NOT become a booking, and "What are your opening hours?"
// must NOT become an availability check.
import {
  extractDate,
  extractService,
  extractTime,
  parseIntent,
} from "@/lib/intent";

describe("parseIntent", () => {
  it("parses a full booking command into all fields", () => {
    const intent = parseIntent(
      "Book a haircut for Emma Thompson, phone (555) 014-2201, on 2026-11-14 at 10:30"
    );
    expect(intent).toEqual({
      kind: "booking",
      service: "Haircut",
      name: "Emma Thompson",
      contact: "(555) 014-2201",
      date: "2026-11-14",
      time: "10:30",
      stylist: undefined,
    });
  });

  it("parses a booking with a stylist and a 12-hour time", () => {
    const intent = parseIntent(
      "Book a balayage with Maya on Saturday at 3pm for Grace Liu, grace.liu@example.com"
    );
    expect(intent.kind).toBe("booking");
    if (intent.kind === "booking") {
      expect(intent.service).toBe("Balayage");
      expect(intent.stylist).toBe("Maya Chen");
      expect(intent.time).toBe("15:00");
      expect(intent.date).toBe("2026-11-07"); // next Saturday after Oct 31
      expect(intent.name).toBe("Grace Liu");
      expect(intent.contact).toBe("grace.liu@example.com");
    }
  });

  it("a booking with only a service reports the rest as missing later", () => {
    const intent = parseIntent("Book a haircut");
    expect(intent.kind).toBe("booking");
    if (intent.kind === "booking") {
      expect(intent.service).toBe("Haircut");
      expect(intent.name).toBeUndefined();
      expect(intent.date).toBeUndefined();
    }
  });

  it("'How do I book an appointment?' is a question, not a booking", () => {
    expect(parseIntent("How do I book an appointment?")).toEqual({
      kind: "none",
    });
    expect(parseIntent("How can I book?")).toEqual({ kind: "none" });
  });

  it("parses an availability question with a weekday", () => {
    const intent = parseIntent("Is Saturday free?");
    expect(intent).toEqual({
      kind: "availability",
      date: "2026-11-07",
      stylist: undefined,
    });
  });

  it("'Are you open on Sundays?' is an availability check for Sunday", () => {
    const intent = parseIntent("Are you open on Sundays?");
    expect(intent).toEqual({
      kind: "availability",
      date: "2026-11-01",
      stylist: undefined,
    });
  });

  it("'What are your opening hours?' is not an availability check", () => {
    expect(parseIntent("What are your opening hours?")).toEqual({
      kind: "none",
    });
  });

  it("out-of-scope questions are not intents", () => {
    expect(parseIntent("Do you sell wedding dresses?")).toEqual({
      kind: "none",
    });
    expect(parseIntent("How much is a haircut?")).toEqual({
      kind: "none",
    });
  });

  it("does not mistake 'for Saturday' for a name", () => {
    const intent = parseIntent("Book a haircut for Saturday at 10:30");
    expect(intent.kind).toBe("booking");
    if (intent.kind === "booking") {
      expect(intent.name).toBeUndefined();
      expect(intent.date).toBe("2026-11-07");
    }
  });
});

describe("extractDate", () => {
  it("reads ISO, 'Nov 14' and '14 November'", () => {
    expect(extractDate("on 2026-11-14")).toBe("2026-11-14");
    expect(extractDate("on Nov 14")).toBe("2026-11-14");
    expect(extractDate("on 14 November")).toBe("2026-11-14");
  });

  it("resolves weekdays to the next occurrence after Oct 31", () => {
    expect(extractDate("on Saturday")).toBe("2026-11-07");
    expect(extractDate("on Sunday")).toBe("2026-11-01");
    expect(extractDate("tomorrow")).toBe("2026-11-01");
  });
});

describe("extractTime", () => {
  it("reads 24-hour, 12-hour and bare-hour times", () => {
    expect(extractTime("at 10:30")).toBe("10:30");
    expect(extractTime("at 10:30am")).toBe("10:30");
    expect(extractTime("at 3pm")).toBe("15:00");
    expect(extractTime("at 9am")).toBe("09:00");
    expect(extractTime("at 12:00")).toBe("12:00");
  });
});

describe("extractService", () => {
  it("maps phrasings to the four services", () => {
    expect(extractService("a haircut")).toBe("Haircut");
    expect(extractService("full colour")).toBe("Full colour");
    expect(extractService("colour")).toBe("Full colour");
    expect(extractService("balayage")).toBe("Balayage");
    expect(extractService("beard trim")).toBe("Beard trim");
    expect(extractService("wedding dresses")).toBeUndefined();
  });
});

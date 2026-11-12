// Assistant tools — the AI-engineer layer.
//
// Three tools, one contract, two callers:
//   - OpenAI mode: the model calls them via real function calling.
//   - Free mode: the deterministic intent parser (lib/intent.ts)
//     calls the same functions directly.
//
// Every tool reads ONLY from the existing single sources of truth:
// services/prices from lib/business.ts, the diary from
// lib/customers.ts (November 2026, 11 appointments), and bookings
// save through the same saveLead() as the booking form — including
// its 60-second duplicate protection. No tool invents data, and no
// tool sends an email or message: a booking is a saved lead the
// studio confirms, never an auto-confirmation.
//
// The response shape is identical in both modes: an action object
// the widget can render, plus a plain-language summary.

import { business, services } from "./business";
import {
  APPOINTMENT_SLOTS,
  getAppointments,
  isOpenDay,
} from "./customers";
import { formatTime } from "./format";
import { saveLead } from "./leads";
import { emitEvent } from "./events";

// The diary covers November 2026 only (see lib/customers.ts).
export const DIARY_START = "2026-11-01";
export const DIARY_END = "2026-11-30";

// Bookable stylists, derived from the diary itself (alphabetical,
// so "first available" is deterministic). Priya Nair is the
// receptionist — she has no appointments and cannot be booked.
export function getBookingStylists(): string[] {
  return Array.from(new Set(getAppointments().map((a) => a.stylist))).sort();
}

export type ChatAction =
  | {
      type: "booking_created";
      service: string;
      date: string;
      time: string;
      stylist: string;
      saved: boolean;
      duplicate?: boolean;
    }
  | { type: "booking_failed"; reason: string }
  | {
      type: "booking_needs_details";
      service?: string;
      missing: string[];
    }
  | {
      type: "availability";
      date: string;
      dayLabel: string;
      free: { stylist: string; times: string[] }[];
    }
  | { type: "availability_failed"; reason: string }
  | {
      type: "services";
      services: { name: string; price: string; time: string }[];
    };

export function getServices() {
  return {
    services: services.map((s) => ({
      name: s.name,
      price: s.price,
      time: s.time,
      note: s.note,
    })),
    hours: business.hours,
    phone: business.phone,
  };
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const weekday = d.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${weekday} ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function getAvailability(args: {
  date: string;
  stylist?: string;
}): ChatAction {
  const { date, stylist } = args;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      type: "availability_failed",
      reason: "I need a date like 2026-11-14 to check availability.",
    };
  }
  if (date < DIARY_START || date > DIARY_END) {
    return {
      type: "availability_failed",
      reason: `The diary here only covers November 2026 — for dates after that, please call ${business.phone}.`,
    };
  }
  if (!isOpenDay(date)) {
    return {
      type: "availability_failed",
      reason: `We're closed on Sundays, so ${dayLabel(date)} has no appointments. We're open Monday to Saturday, 9am to 6pm.`,
    };
  }
  let stylists = getBookingStylists();
  if (stylist) {
    const match = stylists.find(
      (s) => s.toLowerCase() === stylist.toLowerCase()
    );
    if (!match) {
      if (stylist.toLowerCase().includes("priya")) {
        return {
          type: "availability_failed",
          reason:
            "Priya is our receptionist — she doesn't take appointments. The stylists are Amelia, Sofia, Maya and Jordan.",
        };
      }
      return {
        type: "availability_failed",
        reason: `I don't know a stylist called ${stylist}. The stylists are ${stylists.join(", ")}.`,
      };
    }
    stylists = [match];
  }
  const booked = getAppointments().filter((a) => a.date === date);
  const free = stylists.map((s) => ({
    stylist: s,
    times: APPOINTMENT_SLOTS.filter(
      (t) => !booked.some((a) => a.stylist === s && a.time === t)
    ),
  }));
  return { type: "availability", date, dayLabel: dayLabel(date), free };
}

function resolveService(input: string): string | undefined {
  const lower = input.trim().toLowerCase();
  if (lower === "balayage") return "Balayage";
  if (lower === "beard trim" || lower === "beard") return "Beard trim";
  if (lower === "full colour" || lower === "full color" || lower === "colour" || lower === "color")
    return "Full colour";
  if (lower === "haircut" || lower === "hair cut") return "Haircut";
  return services.find((s) => s.name.toLowerCase() === lower)?.name;
}

function resolveStylist(input: string): string | undefined {
  const lower = input.trim().toLowerCase();
  const match = getBookingStylists().find(
    (s) =>
      s.toLowerCase() === lower || s.split(" ")[0].toLowerCase() === lower
  );
  return match;
}

export async function createBooking(args: {
  service: string;
  name: string;
  contact: string;
  date?: string;
  time?: string;
  stylist?: string;
}): Promise<ChatAction> {
  const service = resolveService(args.service);
  if (!service) {
    return {
      type: "booking_failed",
      reason: `I don't know a service called "${args.service}". We offer haircuts, full colour, balayage and beard trims.`,
    };
  }
  const name = (args.name ?? "").trim();
  const contact = (args.contact ?? "").trim();
  if (!name || name.length > 100 || !contact || contact.length > 100) {
    return {
      type: "booking_failed",
      reason: "I need your name and a phone number or email to book.",
    };
  }
  // A contact that is neither a phone number nor an email is not
  // something the studio can reply to.
  if (!/[\d@]/.test(contact)) {
    return {
      type: "booking_failed",
      reason:
        "That contact doesn't look like a phone number or email — how should the studio reach you?",
    };
  }
  const date = (args.date ?? "").trim();
  if (!date) {
    return {
      type: "booking_failed",
      reason: "Which day? The diary covers November 2026.",
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < DIARY_START || date > DIARY_END) {
    return {
      type: "booking_failed",
      reason: `The diary here only covers November 2026 — for dates after that, please call ${business.phone}.`,
    };
  }
  if (!isOpenDay(date)) {
    return {
      type: "booking_failed",
      reason: `We're closed on Sundays, so ${dayLabel(date)} isn't bookable. We're open Monday to Saturday, 9am to 6pm.`,
    };
  }
  const time = (args.time ?? "").trim();
  if (!time) {
    return {
      type: "booking_failed",
      reason: `What time on ${dayLabel(date)}? Slots are ${APPOINTMENT_SLOTS.map(formatTime).join(", ")}.`,
    };
  }
  if (!APPOINTMENT_SLOTS.includes(time)) {
    return {
      type: "booking_failed",
      reason: `We book on the half-hour slots — ${APPOINTMENT_SLOTS.map(formatTime).join(", ")} — so ${time} isn't a slot. Which of those works?`,
    };
  }

  const stylists = getBookingStylists();
  let stylist: string | undefined;
  if (args.stylist) {
    if (args.stylist.trim().toLowerCase().includes("priya")) {
      return {
        type: "booking_failed",
        reason:
          "Priya is our receptionist — she doesn't take appointments. The stylists are Amelia, Sofia, Maya and Jordan.",
      };
    }
    stylist = resolveStylist(args.stylist);
    if (!stylist) {
      return {
        type: "booking_failed",
        reason: `I don't know a stylist called "${args.stylist}". The stylists are ${stylists.join(", ")}.`,
      };
    }
  }

  const booked = getAppointments().filter(
    (a) => a.date === date && a.time === time
  );
  if (!stylist) {
    // No preference: first stylist (alphabetical) with the slot free.
    stylist = stylists.find(
      (s) => !booked.some((a) => a.stylist === s)
    );
    if (!stylist) {
      return {
        type: "booking_failed",
        reason: `Every stylist is booked at ${formatTime(time)} on ${dayLabel(date)}. Try another time — the slots are ${APPOINTMENT_SLOTS.map(formatTime).join(", ")}.`,
      };
    }
  } else if (booked.some((a) => a.stylist === stylist)) {
    const others = stylists.filter(
      (s) => s !== stylist && !booked.some((a) => a.stylist === s)
    );
    return {
      type: "booking_failed",
      reason:
        `${stylist} is already booked at ${formatTime(time)} on ${dayLabel(date)}.` +
        (others.length > 0
          ? ` ${others.join(" and ")} ${others.length === 1 ? "is" : "are"} free then — shall I book you with ${others[0]} instead?`
          : " Every stylist is booked then — try another time."),
    };
  }

  // Same save path as the booking form (lib/leads.ts), including
  // the 60-second duplicate protection.
  const message = `Chat booking: ${service} on ${date} at ${time} with ${stylist}`;
  const result = await saveLead({ name, contact, service, message });
  if (!result.ok) {
    return {
      type: "booking_failed",
      reason: `I couldn't save that booking — please call ${business.phone} and the team will book you in.`,
    };
  }
  if (!result.duplicate) {
    // One booking request is both a new lead and a new appointment,
    // so both automation events fire — exactly as the form does.
    const event = { saved: result.saved, name, contact, service, message };
    void emitEvent("lead.created", event);
    void emitEvent("appointment.booked", event);
  }
  return {
    type: "booking_created",
    service,
    date,
    time,
    stylist,
    saved: result.saved,
    duplicate: result.duplicate,
  };
}

// Dispatch by name — the single entry point for both callers. Args
// are validated inside each tool; unknown tools and bad arg shapes
// fail closed with a booking_failed/availability_failed action,
// never a throw (the route must always answer).
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ action: ChatAction; summary: string }> {
  if (name === "getServices") {
    const data = getServices();
    const action: ChatAction = {
      type: "services",
      services: data.services.map((s) => ({
        name: s.name,
        price: s.price,
        time: s.time,
      })),
    };
    return {
      action,
      summary: `Services: ${data.services.map((s) => `${s.name} ${s.price} (${s.time})`).join("; ")}. Hours: ${data.hours}`,
    };
  }
  if (name === "getAvailability") {
    const date = typeof args.date === "string" ? args.date : "";
    const stylist =
      typeof args.stylist === "string" ? args.stylist : undefined;
    const action = getAvailability({ date, stylist });
    return { action, summary: actionToText(action) };
  }
  if (name === "createBooking") {
    const action = await createBooking({
      service: typeof args.service === "string" ? args.service : "",
      name: typeof args.name === "string" ? args.name : "",
      contact: typeof args.contact === "string" ? args.contact : "",
      date: typeof args.date === "string" ? args.date : undefined,
      time: typeof args.time === "string" ? args.time : undefined,
      stylist: typeof args.stylist === "string" ? args.stylist : undefined,
    });
    return { action, summary: actionToText(action) };
  }
  return {
    action: {
      type: "booking_failed",
      reason: `I don't know a tool called "${name}".`,
    },
    summary: `Unknown tool: ${name}.`,
  };
}

// Plain-language rendering of an action — the free mode's answer
// text, and the text fed back to the model as a tool result.
export function actionToText(action: ChatAction): string {
  switch (action.type) {
    case "booking_created": {
      const when = `${action.date} at ${formatTime(action.time)}`;
      const base =
        `You're booked in for a ${action.service.toLowerCase()} on ${when} with ${action.stylist}. ` +
        `The studio will confirm shortly — please give at least 24 hours notice if you need to cancel.`;
      if (action.duplicate) {
        return (
          `That booking request is already in — a ${action.service.toLowerCase()} on ${when} with ${action.stylist}. ` +
          `The studio will confirm shortly.`
        );
      }
      if (!action.saved) {
        return (
          base +
          ` Note: this request was not saved yet — lead storage is not set up on this demo.`
        );
      }
      return base;
    }
    case "booking_failed":
      return action.reason;
    case "booking_needs_details": {
      const needs = action.missing.join(", ");
      return (
        `Happy to book${action.service ? ` a ${action.service.toLowerCase()}` : ""} — ` +
        `I'll need your ${needs}. The diary covers November 2026 and the slots are ` +
        `${APPOINTMENT_SLOTS.map(formatTime).join(", ")}.`
      );
    }
    case "availability": {
      if (action.free.length === 0) return "No stylists are available.";
      const lines = action.free
        .filter((f) => f.times.length > 0)
        .map(
          (f) =>
            `${f.stylist}: ${f.times.map(formatTime).join(", ")}`
        );
      if (lines.length === 0) {
        return `Everyone is booked on ${action.dayLabel}. Try another day — we're open Monday to Saturday, 9am to 6pm.`;
      }
      return (
        `On ${action.dayLabel} the free slots are:\n` +
        lines.join("\n") +
        `\nSay the word and I'll book one — I'll need your name and a phone number or email.`
      );
    }
    case "availability_failed":
      return action.reason;
    case "services":
      return (
        "We offer: " +
        action.services
          .map((s) => `${s.name} ${s.price} (${s.time})`)
          .join("; ") +
        "."
      );
  }
}

// OpenAI function definitions (gpt-4o-mini). The model sees exactly
// these three tools and nothing else — it cannot invent a service,
// a slot or a stylist, because the tools validate server-side.
export const OPENAI_TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "getServices",
      description:
        "List the salon's services with prices and times, plus opening hours.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getAvailability",
      description:
        "Check which stylists have free appointment slots on a day. The diary covers November 2026 only; the salon is closed on Sundays.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The day to check, as YYYY-MM-DD in November 2026.",
          },
          stylist: {
            type: "string",
            description: "Optional stylist full name, e.g. Maya Chen.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createBooking",
      description:
        "Request a booking. Saves a lead the studio confirms — never claim it is confirmed. Needs service, name, contact, date and time; ask the visitor for anything missing instead of guessing.",
      parameters: {
        type: "object",
        properties: {
          service: {
            type: "string",
            enum: ["Haircut", "Full colour", "Balayage", "Beard trim"],
            description: "The service to book.",
          },
          name: { type: "string", description: "The visitor's name." },
          contact: {
            type: "string",
            description: "A phone number or email the studio can reply to.",
          },
          date: {
            type: "string",
            description: "The day, as YYYY-MM-DD in November 2026.",
          },
          time: {
            type: "string",
            description: "A slot: 09:00, 10:30, 12:00, 13:30, 15:00 or 16:30.",
          },
          stylist: {
            type: "string",
            description: "Optional stylist full name, e.g. Maya Chen.",
          },
        },
        required: ["service", "name", "contact"],
      },
    },
  },
];

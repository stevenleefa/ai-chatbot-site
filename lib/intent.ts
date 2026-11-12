// Deterministic intent parser — the free mode's "understanding".
//
// No LLM, no network: plain regexes over the visitor's message, so
// free mode works offline and every parse is reproducible in a test.
// It only recognises two intents — booking and availability. Anything
// else returns { kind: "none" } and falls through to retrieval.
//
// The parser deliberately does NOT guess: a booking needs a service,
// name, contact, day and time, and the fields it cannot find are
// reported as missing so the bot can ask for them instead of
// inventing them.
//
// Dates are resolved against the demo world's "today", AS_OF_DATE
// (2026-10-31, the dashboard anchor). The diary covers November
// 2026 only; dates outside it are still extracted and then rejected
// by the tools with an honest reason.

import { AS_OF_DATE } from "./dashboard";

export type BookingIntent = {
  kind: "booking";
  service?: string;
  name?: string;
  contact?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM (24-hour)
  stylist?: string; // full name, e.g. "Maya Chen"
};

export type AvailabilityIntent = {
  kind: "availability";
  date?: string; // YYYY-MM-DD
  stylist?: string;
};

export type ParsedIntent =
  | BookingIntent
  | AvailabilityIntent
  | { kind: "none" };

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_WORDS = new Set([
  ...WEEKDAYS,
  "today",
  "tomorrow",
  "november",
  "nov",
]);

const STYLIST_BY_FIRST_NAME: Record<string, string> = {
  amelia: "Amelia Brooks",
  sofia: "Sofia Reyes",
  maya: "Maya Chen",
  jordan: "Jordan Lee",
  priya: "Priya Nair",
};

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Next occurrence of a weekday strictly after the demo "today".
function nextWeekday(name: string): string {
  const target = WEEKDAYS.indexOf(name.toLowerCase());
  const d = new Date(AS_OF_DATE + "T12:00:00Z");
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== target);
  return d.toISOString().slice(0, 10);
}

// "2026-11-14", "Nov 14", "14 November", "Saturday", "tomorrow".
// Explicit dates win over weekday names: "Saturday 14 November"
// is the 14th, not the next Saturday.
export function extractDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const monthFirst = text.match(
    /\b(?:nov|november)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
  );
  if (monthFirst) return `2026-11-${monthFirst[1].padStart(2, "0")}`;

  const dayFirst = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:nov|november)\b/i
  );
  if (dayFirst) return `2026-11-${dayFirst[1].padStart(2, "0")}`;

  const weekday = text.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/i
  );
  if (weekday) return nextWeekday(weekday[1]);

  if (/\btomorrow\b/i.test(text)) return addDays(AS_OF_DATE, 1);
  if (/\btoday\b/i.test(text)) return AS_OF_DATE;
  return undefined;
}

// "10:30", "10:30am", "3pm", "3" (a bare hour inside salon hours
// means that afternoon — "3" is 3pm, "9" is 9am). Returns 24-hour
// "HH:MM". Slot validation happens in the tools, not here.
export function extractTime(text: string): string | undefined {
  const withMeridiem = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (withMeridiem) {
    let h = Number(withMeridiem[1]);
    const m = withMeridiem[2] ?? "00";
    const meridiem = withMeridiem[3].toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const plain = text.match(/(\d{1,2}):(\d{2})\b/);
  if (plain) {
    let h = Number(plain[1]);
    if (h >= 1 && h <= 8) h += 12; // "3:00" inside salon hours is 3pm
    return `${String(h).padStart(2, "0")}:${plain[2]}`;
  }
  return undefined;
}

// Service names, longest match first. A bare "colour" means Full
// colour (the standard colour service); balayage needs its own word.
export function extractService(text: string): string | undefined {
  if (/\bbalayage\b/i.test(text)) return "Balayage";
  if (/\bbeard\b/i.test(text)) return "Beard trim";
  if (/\bfull\s+colou?r\b/i.test(text) || /\bcolou?r\b/i.test(text))
    return "Full colour";
  if (/\bhair\s?cut\b/i.test(text)) return "Haircut";
  return undefined;
}

// "for Emma Thompson" / "my name is Emma Thompson". A weekday or
// month word after "for" is a date, not a name ("book for Saturday").
export function extractName(text: string): string | undefined {
  const m = text.match(
    /\b(?:for|my name is)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/
  );
  if (!m) return undefined;
  if (DAY_WORDS.has(m[1].split(" ")[0].toLowerCase())) return undefined;
  return m[1].trim();
}

export function extractContact(text: string): string | undefined {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) return email[0];
  const phone = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (phone) return phone[0].trim();
  return undefined;
}

export function extractStylist(text: string): string | undefined {
  for (const [first, full] of Object.entries(STYLIST_BY_FIRST_NAME)) {
    if (new RegExp(`\\b${first}\\b`, "i").test(text)) return full;
  }
  return undefined;
}

export function parseIntent(message: string): ParsedIntent {
  const lower = message.toLowerCase();

  // "How do I book an appointment?" is a question ABOUT booking, not
  // a booking — it must fall through to retrieval (which answers it
  // with the phone number), never to the booking flow.
  const isHowQuestion =
    /^\s*how\b/.test(lower) || /\bhow\s+(do|can|to)\b/.test(lower);
  if (!isHowQuestion) {
    const service = extractService(message);
    const hasBookWord = /\b(book|booking|reserve|reservation)\b/.test(lower);
    const wantsAppointment =
      /\b(want|would like|like to|need|looking for|can i|could i|may i)\b.{0,40}\b(book|booking|appointment|reserve)\b/.test(
        lower
      );
    const directBook =
      /\bbook\s+(me|us|in|an?\s+appointment|a\s+slot|for)\b/.test(lower);
    if (
      (hasBookWord || /\bappointment\b/.test(lower)) &&
      (service || wantsAppointment || directBook)
    ) {
      return {
        kind: "booking",
        service,
        name: extractName(message),
        contact: extractContact(message),
        date: extractDate(message),
        time: extractTime(message),
        stylist: extractStylist(message),
      };
    }
  }

  // Availability needs a day AND an availability word: "What are your
  // opening hours?" has "open" but no day, so it stays a retrieval
  // question (and "Are you open on Sundays?" correctly becomes an
  // availability check for the next Sunday).
  const date = extractDate(message);
  const hasAvailabilityWord =
    /\b(free|available|availability|slots?|open)\b/.test(lower);
  if (date && hasAvailabilityWord) {
    return { kind: "availability", date, stylist: extractStylist(message) };
  }

  return { kind: "none" };
}

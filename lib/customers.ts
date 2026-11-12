// Customers + appointments — SAMPLE / DEMO data for Lumen Hair Studio.
//
// Everything here is fictional sample data, defined in code. There is no
// Supabase table and no new env var: the customers and appointments pages
// work with zero configuration.
//
// THE ROSTER IS THE ONLY HAND-WRITTEN DATA: 12 fictional regulars with
// contact details and the retail products they bought. Everything else
// is COMPUTED from those rows plus the dashboard's sales rows — never
// hardcoded — so the numbers always tie out:
//   - procedures (past services) are a subset of the dashboard SALES rows
//   - visits / total spent / last visit come from those procedures +
//     the purchases below
//   - next due date comes from the most recent service of each type +
//     that service's usual interval
//   - recommendations and nudge messages are rules over that history
//
// SALES TIE-IN (why the procedures are real dashboard rows): the
// procedures for each regular are picked from the dashboard's SALES
// array using ONLY the sale's index — every 19th sale starting at
// index 7 (73 picked sales), dealt round-robin to the 12 regulars, so
// the first regular gets 7 visits and the rest get 6. The rest of the
// sales stay unattributed walk-ins. No extra random draws, and
// lib/dashboard.ts is untouched, so the sales generator's output and
// every verified dashboard figure stay byte-identical (1,377 sales,
// $72,070 total; Aug $22,615 / Sep $24,460 / Oct $24,995).
//
// WHY THE PICK IS 19 / 7: the stride and offset were chosen so the
// derived mix is a sensible demo — 8 regulars with a November booking
// and 4 due a nudge — instead of nearly everyone overdue. See
// CUSTOMERS.md for the full reasoning.
//
// "TODAY" IN THIS DEMO WORLD is AS_OF_DATE (2026-10-31, the dashboard's
// anchor): appointments are the November 2026 diary, and a customer
// needs a nudge when their next due date is past or within 7 days of
// Oct 31 and they have no booked appointment.

import {
  AS_OF_DATE,
  SALES,
  fmtDate,
  money,
  round2,
  sum,
  type Sale,
} from "./dashboard";
import { PRODUCTS } from "./products";

// --- Dates (local helpers; lib/dashboard.ts keeps its own private copies) --

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000
  );
}

// Exported for the chatbot tools (lib/tools.ts): availability and
// booking both need the same open-day rule as the diary.
export function isOpenDay(iso: string): boolean {
  const d = new Date(iso + "T12:00:00Z").getUTCDay(); // 0 Sun ... 6 Sat
  return d >= 1 && d <= 6; // Mon-Sat — the salon opened Mondays in
  // November 2026. The historical Aug–Oct SALES in lib/dashboard.ts
  // stay Tue–Sat: history is not rewritten (see CUSTOMERS.md).
}

// 12-hour clock for display only — lives in lib/format.ts (no data
// imports) so client components can use it too; re-exported here for
// the server pages that already import from this file.
export { formatTime } from "./format";

// --- Usual service intervals ------------------------------------------------

export const SERVICE_INTERVAL_DAYS: Record<string, number> = {
  "Haircut": 42, // 6 weeks
  "Beard trim": 21, // 3 weeks
  "Full colour": 56, // 8 weeks
  "Balayage": 70, // 10 weeks
};

// A customer needs a nudge when their next due date is past, or within
// this many days, and they have no booked appointment.
export const NUDGE_WITHIN_DAYS = 7;

// --- Retail products (the shop shelf; prices are the sell prices) ----------
// The single source of truth is the shop catalogue in lib/products.ts;
// this record is derived from it, so the customers code and the shop
// can never disagree on a price. It is keyed by product name, in
// dollars, because the purchase rows below are written that way.
export const RETAIL_PRODUCTS: Record<string, number> = Object.fromEntries(
  PRODUCTS.map((p) => [p.name, p.priceCents / 100])
);

const COLOUR_SERVICES = ["Full colour", "Balayage"];
const COLOUR_CARE_PRODUCTS = ["Colour-care shampoo", "Colour-care mask"];

// --- The roster (the only hand-written data) --------------------------------

export type Customer = {
  id: string; // URL slug: /customers/<id>
  name: string;
  phone: string;
  email: string;
};

export type Purchase = {
  date: string; // YYYY-MM-DD — always on one of their visit dates
  product: string;
  price: number;
};

type RosterEntry = Customer & {
  // Retail products bought, as { date, product }; the price comes from
  // RETAIL_PRODUCTS so a product can never disagree with its price.
  purchases: Array<{ date: string; product: string }>;
};

const ROSTER: RosterEntry[] = [
  {
    id: "emma-thompson", name: "Emma Thompson",
    phone: "(555) 014-2201", email: "emma.thompson@example.com",
    purchases: [
      { date: "2026-09-02", product: "Colour-care shampoo" },
      { date: "2026-10-17", product: "Hairspray" },
    ],
  },
  {
    id: "grace-liu", name: "Grace Liu",
    phone: "(555) 014-2202", email: "grace.liu@example.com",
    purchases: [
      { date: "2026-08-19", product: "Shampoo (1L)" },
      { date: "2026-09-03", product: "Conditioner (1L)" },
    ],
  },
  {
    id: "olivia-bennett", name: "Olivia Bennett",
    phone: "(555) 014-2203", email: "olivia.bennett@example.com",
    purchases: [{ date: "2026-09-18", product: "Shampoo (1L)" }],
  },
  {
    id: "noah-patel", name: "Noah Patel",
    phone: "(555) 014-2204", email: "noah.patel@example.com",
    purchases: [
      { date: "2026-08-21", product: "Styling gel" },
      { date: "2026-09-04", product: "Leave-in treatment" },
    ],
  },
  {
    id: "ava-rodriguez", name: "Ava Rodriguez",
    phone: "(555) 014-2205", email: "ava.rodriguez@example.com",
    purchases: [
      { date: "2026-09-22", product: "Colour-care shampoo" },
      { date: "2026-10-22", product: "Colour-care mask" },
    ],
  },
  {
    id: "liam-oconnor", name: "Liam O'Connor",
    phone: "(555) 014-2206", email: "liam.oconnor@example.com",
    purchases: [{ date: "2026-09-08", product: "Beard oil" }],
  },
  {
    id: "sophia-kim", name: "Sophia Kim",
    phone: "(555) 014-2207", email: "sophia.kim@example.com",
    purchases: [{ date: "2026-09-09", product: "Shampoo (1L)" }],
  },
  {
    id: "mason-wright", name: "Mason Wright",
    phone: "(555) 014-2208", email: "mason.wright@example.com",
    purchases: [{ date: "2026-08-26", product: "Conditioner (1L)" }],
  },
  {
    id: "isabella-chen", name: "Isabella Chen",
    phone: "(555) 014-2209", email: "isabella.chen@example.com",
    purchases: [{ date: "2026-09-11", product: "Colour-care shampoo" }],
  },
  {
    id: "lucas-meyer", name: "Lucas Meyer",
    phone: "(555) 014-2210", email: "lucas.meyer@example.com",
    purchases: [
      { date: "2026-09-12", product: "Leave-in treatment" },
      { date: "2026-10-14", product: "Hairspray" },
    ],
  },
  {
    id: "mia-johansson", name: "Mia Johansson",
    phone: "(555) 014-2211", email: "mia.johansson@example.com",
    purchases: [
      { date: "2026-09-15", product: "Shampoo (1L)" },
      { date: "2026-10-15", product: "Styling gel" },
    ],
  },
  {
    id: "ethan-clarke", name: "Ethan Clarke",
    phone: "(555) 014-2212", email: "ethan.clarke@example.com",
    purchases: [
      { date: "2026-10-16", product: "Colour-care shampoo" },
      { date: "2026-10-31", product: "Heat protect spray" },
    ],
  },
];

// --- Procedures from the dashboard sales rows --------------------------------

// Every 19th sale from index 7, dealt round-robin to the roster. Uses
// only the sale's index — no extra random draws — so SALES is untouched.
const PICK_STRIDE = 19;
const PICK_OFFSET = 7;

function proceduresFor(rosterIndex: number): Sale[] {
  const picked: Sale[] = [];
  for (let i = PICK_OFFSET; i < SALES.length; i += PICK_STRIDE) {
    picked.push(SALES[i]);
  }
  // picked[k] belongs to roster[k % 12]; sales are already in date order.
  return picked.filter((_, k) => k % ROSTER.length === rosterIndex);
}

// --- Derived values -----------------------------------------------------------

export type ServiceDue = {
  service: string;
  count: number;
  lastDate: string;
  dueDate: string;
};

export type Recommendation = {
  product: string;
  price: number;
  reason: string;
};

export type Appointment = {
  id: string;
  customerId: string;
  date: string; // YYYY-MM-DD, November 2026, an open day (Mon-Sat)
  time: string; // 09:00–16:30, inside salon hours (stored 24-hour;
  // displayed 12-hour via formatTime)
  service: string;
  stylist: string;
  status: "confirmed" | "requested";
};

export type CustomerSummary = {
  customer: Customer;
  procedures: Sale[]; // date order, oldest first
  purchases: Purchase[];
  firstVisit: string;
  lastVisit: string;
  preferredStylist: string;
  visits: number;
  servicesTotal: number;
  purchasesTotal: number;
  totalSpent: number;
  // Due dates, one per recurring service (had 2+ times), soonest first.
  // A one-off service does not set a cycle: a beard trim had once in
  // August does not make a regular "overdue" for beard trims.
  dues: ServiceDue[];
  nextDueDate: string;
  nextDueService: string;
  nextDueLastDate: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  appointment: Appointment | null; // first booking (compat; see below)
  appointments: Appointment[]; // every booking, date order (usually 1;
  // 2 when a second service is also due in November)
  needsNudge: boolean;
  recommendations: Recommendation[];
  nudgeMessage: string;
};

export const APPOINTMENT_SLOTS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];

function serviceDues(procedures: Sale[]): ServiceDue[] {
  const byService = new Map<string, { count: number; lastDate: string }>();
  for (const p of procedures) {
    const row = byService.get(p.service) ?? { count: 0, lastDate: "" };
    row.count += 1;
    if (p.date > row.lastDate) row.lastDate = p.date;
    byService.set(p.service, row);
  }
  const dues: ServiceDue[] = [];
  byService.forEach((row, service) => {
    // Only recurring services set a cycle. If nothing recurs (a
    // customer with all one-off services), fall back to their most
    // recent visit below.
    if (row.count < 2) return;
    dues.push({
      service,
      count: row.count,
      lastDate: row.lastDate,
      dueDate: addDays(row.lastDate, SERVICE_INTERVAL_DAYS[service]),
    });
  });
  if (dues.length === 0 && procedures.length > 0) {
    const last = procedures[procedures.length - 1];
    dues.push({
      service: last.service,
      count: 1,
      lastDate: last.date,
      dueDate: addDays(last.date, SERVICE_INTERVAL_DAYS[last.service]),
    });
  }
  return dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function preferredStylist(procedures: Sale[]): string {
  const counts = new Map<string, number>();
  for (const p of procedures) counts.set(p.stylist, (counts.get(p.stylist) ?? 0) + 1);
  // Most visits; ties go to the stylist of the most recent visit.
  let best = "";
  let bestCount = -1;
  for (let i = procedures.length - 1; i >= 0; i--) {
    const stylist = procedures[i].stylist;
    const count = counts.get(stylist) ?? 0;
    if (count > bestCount) {
      best = stylist;
      bestCount = count;
    }
  }
  return best;
}

function recommendationsFor(
  procedures: Sale[],
  purchases: Purchase[]
): Recommendation[] {
  const bought = new Set(purchases.map((p) => p.product));
  const services = new Set(procedures.map((p) => p.service));
  const hadColour = COLOUR_SERVICES.some((s) => services.has(s));
  const hadBalayage = services.has("Balayage");
  const hadHaircut = services.has("Haircut");
  const beardCount = procedures.filter((p) => p.service === "Beard trim").length;
  const hasShampoo =
    bought.has("Shampoo (1L)") || bought.has("Colour-care shampoo");
  const recs: Recommendation[] = [];

  if (hadColour) {
    if (!bought.has("Colour-care shampoo")) {
      const lastColour = [...procedures]
        .reverse()
        .find((p) => COLOUR_SERVICES.includes(p.service))!;
      recs.push({
        product: "Colour-care shampoo",
        price: RETAIL_PRODUCTS["Colour-care shampoo"],
        reason: `Keeps colour fresh longer after their ${lastColour.service.toLowerCase()} on ${fmtDate(lastColour.date)}.`,
      });
    }
    if (!bought.has("Colour-care mask")) {
      recs.push({
        product: "Colour-care mask",
        price: RETAIL_PRODUCTS["Colour-care mask"],
        reason: "A weekly mask keeps colour vivid between colour appointments.",
      });
    }
  }
  if (hasShampoo && !bought.has("Conditioner (1L)")) {
    recs.push({
      product: "Conditioner (1L)",
      price: RETAIL_PRODUCTS["Conditioner (1L)"],
      reason: "They buy shampoo but haven't tried the matching conditioner.",
    });
  }
  if (hadBalayage && !bought.has("Leave-in treatment")) {
    recs.push({
      product: "Leave-in treatment",
      price: RETAIL_PRODUCTS["Leave-in treatment"],
      reason: "Balayage ends can dry out — a leave-in keeps them soft between visits.",
    });
  }
  if (beardCount >= 2 && !bought.has("Beard oil")) {
    recs.push({
      product: "Beard oil",
      price: RETAIL_PRODUCTS["Beard oil"],
      reason: "Regular beard trims — beard oil keeps it soft and tidy between visits.",
    });
  }
  if (hadColour && !bought.has("Heat protect spray")) {
    recs.push({
      product: "Heat protect spray",
      price: RETAIL_PRODUCTS["Heat protect spray"],
      reason: "Colour plus heat styling — heat protect keeps the colour from fading.",
    });
  }
  if (recs.length === 0) {
    if (hadHaircut && !bought.has("Styling gel")) {
      recs.push({
        product: "Styling gel",
        price: RETAIL_PRODUCTS["Styling gel"],
        reason: "A versatile finish for their haircut.",
      });
    } else {
      recs.push({
        product: "Shampoo (1L)",
        price: RETAIL_PRODUCTS["Shampoo (1L)"],
        reason: "The studio's everyday shampoo — an easy add-on at their next visit.",
      });
    }
  }
  return recs;
}

function nudgeMessage(
  firstName: string,
  dueService: string,
  lastDate: string
): string {
  const days = dayDiff(lastDate, AS_OF_DATE);
  const since =
    days < 7
      ? `your last ${dueService.toLowerCase()} was ${days} day${days === 1 ? "" : "s"} ago`
      : `it's been ${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} since your last ${dueService.toLowerCase()}`;
  return (
    `Hi ${firstName}, ${since} at Lumen — you're due for one. ` +
    `Shall I book you in this week? — Lumen Hair Studio`
  );
}

function buildSummaries(): CustomerSummary[] {
  return ROSTER.map((entry, index) => {
    const procedures = proceduresFor(index);
    const purchases: Purchase[] = entry.purchases.map((p) => ({
      ...p,
      price: RETAIL_PRODUCTS[p.product],
    }));
    const dues = serviceDues(procedures);
    const next = dues[0];
    const servicesTotal = round2(sum(procedures.map((p) => p.price)));
    const purchasesTotal = round2(sum(purchases.map((p) => p.price)));
    const isOverdue = next.dueDate < AS_OF_DATE;
    const isDueSoon =
      !isOverdue && dayDiff(AS_OF_DATE, next.dueDate) <= NUDGE_WITHIN_DAYS;
    const firstName = entry.name.split(" ")[0];
    return {
      customer: entry,
      procedures,
      purchases,
      firstVisit: procedures[0].date,
      lastVisit: procedures[procedures.length - 1].date,
      preferredStylist: preferredStylist(procedures),
      visits: procedures.length,
      servicesTotal,
      purchasesTotal,
      totalSpent: round2(servicesTotal + purchasesTotal),
      dues,
      nextDueDate: next.dueDate,
      nextDueService: next.service,
      nextDueLastDate: next.lastDate,
      isOverdue,
      isDueSoon,
      appointment: null, // filled in by getAppointments() below
      appointments: [], // filled in by getAppointments() below
      needsNudge: false, // filled in below, once appointments exist
      recommendations: recommendationsFor(procedures, purchases),
      nudgeMessage: nudgeMessage(firstName, next.service, next.lastDate),
    };
  });
}

const SUMMARIES: CustomerSummary[] = buildSummaries();

// --- Appointments ------------------------------------------------------------
//
// A booked next visit for most regulars, at (or just after) their next
// due date, on an open day in November 2026. Regulars whose next due
// date is past or within 7 days are NOT booked — they are the nudge
// cases on the appointments page. Times come from a fixed slot list so
// the diary is deterministic; "requested" is every fourth regular
// (index % 4 === 2), the rest are "confirmed".
//
// SECOND APPOINTMENTS: a regular can also have a second November
// booking, for a DIFFERENT service whose own due date falls in
// November (their second due in dues[]). The nudge cases never get
// one — their next due is the nudge, not a booking — so the nudge
// count stays 4. A second booking must not clash: its slot is picked
// from the slot list, skipping any slot already used by the same
// stylist or the same customer on that date.
function pickSlot(
  stylist: string,
  customerId: string,
  date: string,
  startAt: number,
  existing: Appointment[]
): string {
  for (let k = 0; k < APPOINTMENT_SLOTS.length; k++) {
    const time = APPOINTMENT_SLOTS[(startAt + k) % APPOINTMENT_SLOTS.length];
    const clash = existing.some(
      (a) =>
        a.date === date &&
        a.time === time &&
        (a.stylist === stylist || a.customerId === customerId)
    );
    if (!clash) return time;
  }
  return APPOINTMENT_SLOTS[startAt % APPOINTMENT_SLOTS.length];
}

function buildAppointments(): Appointment[] {
  const appointments: Appointment[] = [];
  for (let i = 0; i < SUMMARIES.length; i++) {
    const s = SUMMARIES[i];
    // Due soon (or overdue) with no booking yet = a nudge case, not a diary entry.
    if (s.isOverdue || s.isDueSoon) continue;
    const mine: Appointment[] = [];
    // First booking: soonest due date, shifted to the next open day.
    let date = s.nextDueDate;
    while (!isOpenDay(date)) date = addDays(date, 1);
    const day = Number(date.slice(8, 10));
    mine.push({
      id: `appt-${s.customer.id}`,
      customerId: s.customer.id,
      date,
      time: pickSlot(
        s.preferredStylist,
        s.customer.id,
        date,
        (i * 2 + day) % APPOINTMENT_SLOTS.length,
        appointments
      ),
      service: s.nextDueService,
      stylist: s.preferredStylist,
      status: i % 4 === 2 ? "requested" : "confirmed",
    });
    // Second booking: a different service whose own due date falls in
    // November. Same stylist, same status rule, different slot.
    const second = s.dues[1];
    if (
      second &&
      second.dueDate >= "2026-11-01" &&
      second.dueDate <= "2026-11-30"
    ) {
      let date2 = second.dueDate;
      while (!isOpenDay(date2)) date2 = addDays(date2, 1);
      const day2 = Number(date2.slice(8, 10));
      mine.push({
        id: `appt-${s.customer.id}-2`,
        customerId: s.customer.id,
        date: date2,
        time: pickSlot(
          s.preferredStylist,
          s.customer.id,
          date2,
          (i * 2 + day2 + 3) % APPOINTMENT_SLOTS.length,
          [...appointments, ...mine]
        ),
        service: second.service,
        stylist: s.preferredStylist,
        status: i % 4 === 2 ? "requested" : "confirmed",
      });
    }
    appointments.push(...mine);
    s.appointments = mine;
    s.appointment = mine[0];
  }
  appointments.sort((a, b) =>
    a.date === b.date
      ? a.time.localeCompare(b.time)
      : a.date.localeCompare(b.date)
  );
  for (const s of SUMMARIES) {
    s.needsNudge = (s.isOverdue || s.isDueSoon) && s.appointment === null;
  }
  return appointments;
}

const APPOINTMENTS: Appointment[] = buildAppointments();

export function getCustomerSummaries(): CustomerSummary[] {
  return SUMMARIES;
}

export function getCustomersSortedByDue(): CustomerSummary[] {
  return [...SUMMARIES].sort((a, b) =>
    a.nextDueDate.localeCompare(b.nextDueDate)
  );
}

export function getCustomerSummary(id: string): CustomerSummary | null {
  return SUMMARIES.find((s) => s.customer.id === id) ?? null;
}

export function getAppointments(): Appointment[] {
  return APPOINTMENTS;
}

export function getNudgeCustomers(): CustomerSummary[] {
  return SUMMARIES.filter((s) => s.needsNudge).sort((a, b) =>
    a.nextDueDate.localeCompare(b.nextDueDate)
  );
}

// Assistant tools — the AI-engineer layer.
//
// Six tools, one contract, two callers:
//   - OpenAI mode: the model calls them via real function calling.
//   - Free mode: the deterministic intent parser (lib/intent.ts)
//     calls the same functions directly.
//
// Every tool reads ONLY from the existing single sources of truth:
// services/prices from lib/business.ts, the diary from
// lib/customers.ts (November 2026, 11 appointments), products and
// sale prices from lib/products.ts, and bookings save through the
// same saveLead() as the booking form — including its 60-second
// duplicate protection. No tool invents data, and no tool sends an
// email or message: a booking is a saved lead the studio confirms,
// never an auto-confirmation.
//
// addToCart is the one tool with a client half: server code cannot
// write localStorage, so the tool validates (product exists, is
// active, is in stock, quantity 1–99) and returns the structured
// action { action: "addToCart", productId, quantity }, and the chat
// widget writes it to the "lumen-cart" cart — re-validating against
// the catalogue first (see lib/chat-cart.ts).
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
import {
  PRODUCTS,
  formatPrice,
  getDiscountLabel,
  getProduct,
  getSalePriceCents,
  type Product,
} from "./products";

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
    }
  // Shop products (grounded in lib/products.ts only — every price
  // comes from the catalogue via the pricing helpers, sale prices
  // included, never from the model or the visitor).
  | {
      type: "products";
      products: ProductSummary[];
      query: string;
    }
  | {
      type: "product_recommendation";
      product: ProductSummary;
      reason: string;
    }
  // The cart action: the widget writes this to the localStorage
  // cart (see lib/chat-cart.ts). `action: "addToCart"` is the
  // literal shape the client looks for; `type` is the union tag.
  | {
      type: "cart_added";
      action: "addToCart";
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: string;
    }
  | { type: "cart_failed"; reason: string }
  | { type: "product_failed"; reason: string };

// One product as the chat may state it: real prices only, the sale
// price next to the original when there is a sale.
export type ProductSummary = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  salePrice: string | null;
  discount: string | null;
};

function productSummary(p: Product): ProductSummary {
  const salePriceCents = getSalePriceCents(p);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: formatPrice(p.priceCents),
    salePrice:
      salePriceCents !== p.priceCents ? formatPrice(salePriceCents) : null,
    discount: getDiscountLabel(p),
  };
}

function productPriceLine(p: ProductSummary): string {
  if (p.salePrice) {
    return `${p.name} — ${p.salePrice} (was ${p.price}${p.discount ? `, ${p.discount}` : ""})`;
  }
  return `${p.name} — ${p.price}`;
}

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

// --- Shop product tools -----------------------------------------------------
//
// Grounded in lib/products.ts only. Only ACTIVE products are ever
// listed or recommended (a removed product is gone from the shop);
// a price is always the catalogue price via getSalePriceCents, so
// a sale price is stated, never the pre-sale price.

// Search the catalogue by name / category / keyword. Name matches
// count most, then category, then description. At most 5 results,
// best first. No match is an empty list, not a failure — the route
// falls through to the grounded refusal when nothing matches.
export function searchProducts(query: string): ChatAction {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return { type: "products", products: [], query };
  }
  const scored = PRODUCTS.filter((p) => p.active)
    .map((p) => {
      const name = p.name.toLowerCase();
      const category = p.category.toLowerCase();
      const hay = `${name} ${category} ${p.description.toLowerCase()}`;
      let score = 0;
      for (const t of tokens) {
        if (name.includes(t)) score += 3;
        else if (category.includes(t)) score += 2;
        else if (hay.includes(t)) score += 1;
      }
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return {
    type: "products",
    products: scored.map((s) => productSummary(s.p)),
    query,
  };
}

// Needs are matched by keyword, in order: the first candidate list
// whose pattern matches the need. Only in-stock, active products
// are ever recommended — if the best match is out of stock, the
// reason says so and names the closest in-stock pick instead.
// With no recognised need, the featured product is the pick.
const NEED_CANDIDATES: { match: RegExp; ids: string[] }[] = [
  { match: /colou?r|dyed/, ids: ["colour-care-mask", "colour-care-shampoo", "colour-care-gift-set"] },
  { match: /dry|damaged|split/, ids: ["leave-in-treatment", "hair-oil", "colour-care-mask"] },
  { match: /beard/, ids: ["beard-oil"] },
  { match: /frizz|curly|smooth|shine/, ids: ["styling-cream", "hair-oil"] },
  { match: /heat/, ids: ["heat-protect-spray"] },
  { match: /gift/, ids: ["colour-care-gift-set", "everyday-gift-set"] },
  { match: /scalp/, ids: ["scalp-scrub", "shampoo-1l"] },
  { match: /volume|refresh|between wash/, ids: ["dry-shampoo"] },
  { match: /hold|definition|texture/, ids: ["styling-gel", "hairspray"] },
];

export function recommendProduct(need: string): ChatAction {
  const lower = need.toLowerCase();
  const entry = NEED_CANDIDATES.find((e) => e.match.test(lower));
  const ids = entry ? entry.ids : ["colour-care-mask"];
  const candidates = ids
    .map((id) => getProduct(id))
    .filter((p): p is Product => p !== null);
  const first = candidates[0];
  const pick = candidates.find((p) => p.active && p.inStock);
  if (!pick) {
    return {
      type: "product_failed",
      reason:
        `The ${first ? first.name : "product"} for that isn't available at the moment — ` +
        `please ask in the studio and the team will suggest something.`,
    };
  }
  // The reason is one line tied to the product's own description.
  const reason =
    first && first.id !== pick.id
      ? `The ${first.name} is out of stock at the moment, so the closest in-stock pick is the ${pick.name} — ${pick.description}`
      : pick.description;
  return {
    type: "product_recommendation",
    product: productSummary(pick),
    reason,
  };
}

// Server-side validation for an add-to-cart request, shared by the
// tool and the tests. Pure: takes the product (or null) so an
// inactive product can be tested without touching the catalogue.
export function validateAddToCart(
  product: Product | null,
  quantity: unknown
): { ok: true; product: Product; quantity: number } | { ok: false; reason: string } {
  if (!product) {
    return {
      ok: false,
      reason:
        "I don't have a product by that name in the shop — the range is on the shop page.",
    };
  }
  if (!product.active) {
    return {
      ok: false,
      reason: `The ${product.name} is no longer in the shop.`,
    };
  }
  if (!product.inStock) {
    return {
      ok: false,
      reason: `The ${product.name} is out of stock at the moment — check back soon, or ask in the studio.`,
    };
  }
  const qty =
    typeof quantity === "number"
      ? quantity
      : typeof quantity === "string" && /^\d+$/.test(quantity.trim())
        ? Number(quantity)
        : NaN;
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return {
      ok: false,
      reason: "The quantity has to be a whole number from 1 to 99.",
    };
  }
  return { ok: true, product, quantity: qty };
}

function findProductsByName(name: string): Product[] {
  const lower = name.trim().toLowerCase();
  if (!lower) return [];
  const exact = PRODUCTS.filter((p) => p.name.toLowerCase() === lower);
  if (exact.length > 0) return exact;
  return PRODUCTS.filter((p) => p.name.toLowerCase().includes(lower));
}

export function addToCart(args: {
  productId?: string;
  productName?: string;
  quantity?: unknown;
}): ChatAction {
  let product: Product | null = null;
  if (args.productId) {
    product = getProduct(args.productId);
    if (!product) {
      return {
        type: "cart_failed",
        reason:
          "I don't have a product by that name in the shop — the range is on the shop page.",
      };
    }
  } else if (args.productName) {
    const matches = findProductsByName(args.productName);
    if (matches.length === 0) {
      return {
        type: "cart_failed",
        reason: `I don't have a product called "${args.productName}" in the shop — the range is on the shop page.`,
      };
    }
    if (matches.length > 1) {
      return {
        type: "cart_failed",
        reason: `"${args.productName}" matches more than one product — ${matches.map((m) => m.name).join(", ")}. Which one did you mean?`,
      };
    }
    product = matches[0];
  } else {
    return {
      type: "cart_failed",
      reason: "Which product should I add to your cart?",
    };
  }
  const checked = validateAddToCart(product, args.quantity ?? 1);
  if (!checked.ok) return { type: "cart_failed", reason: checked.reason };
  // The widget writes this to the localStorage cart (it re-validates
  // first — see lib/chat-cart.ts). No cart is written here: server
  // code cannot touch localStorage.
  return {
    type: "cart_added",
    action: "addToCart",
    productId: checked.product.id,
    productName: checked.product.name,
    quantity: checked.quantity,
    unitPrice: formatPrice(getSalePriceCents(checked.product)),
  };
}

// --- Free-mode product intent ----------------------------------------------
//
// lib/intent.ts is the booking/availability parser; product intent
// lives here so the route can run the product tools in free mode
// without touching it. Deterministic, same as the rest of free
// mode: a product name in the message, an "add … to cart", or a
// "recommend … for …". Service questions are never hijacked: a
// message naming a service ("beard trim", "haircut", "balayage",
// "full colour") with no product in it is not a product intent,
// so "Do you do beard trims?" still reaches retrieval ($15).

export type ProductIntent =
  | {
      kind: "product_add";
      productId?: string;
      productName?: string;
      quantity: number;
    }
  | { kind: "product_recommend"; need: string }
  | { kind: "product_search"; query: string }
  | { kind: "none" };

const PRODUCT_WORDS = [
  "shampoo",
  "conditioner",
  "mask",
  "hairspray",
  "gel",
  "spray",
  "cream",
  "scrub",
  "gift set",
  "beard oil",
];

const SERVICE_WORDS = /\b(beard\s*trims?|hair\s*cuts?|balayage|full\s*colou?rs?)\b/;

function findNamedProduct(text: string): Product | null {
  const lower = text.toLowerCase();
  // Longest names first, so "colour-care shampoo" wins over a
  // bare "shampoo" substring.
  const sorted = [...PRODUCTS].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    if (lower.includes(p.name.toLowerCase())) return p;
  }
  return null;
}

export function parseProductIntent(message: string): ProductIntent {
  const lower = message.toLowerCase();

  // "Add the colour-care mask to my cart" / "Add 2 shampoos to cart".
  if (/\b(add|put)\b.{0,60}\b(cart|basket)\b/.test(lower)) {
    const named = findNamedProduct(message);
    const qtyMatch = message.match(/\b(\d{1,2})\s*(?:x|×)?\b/);
    const quantity = qtyMatch ? Number(qtyMatch[1]) : 1;
    if (named) return { kind: "product_add", productId: named.id, quantity };
    const afterAdd = message.match(/\badd\b\s+(?:the\s+)?(.+?)\s+to\b/i);
    return {
      kind: "product_add",
      productName: (afterAdd?.[1] ?? "").trim(),
      quantity,
    };
  }

  // "What do you recommend for dry hair?" / "Suggest something for my beard".
  if (
    /\b(recommend|suggest)\b/.test(lower) ||
    /\bwhat\b.{0,30}\b(best|good)\b.{0,30}\bfor\b/.test(lower)
  ) {
    return { kind: "product_recommend", need: message };
  }

  const named = findNamedProduct(message);
  if (named) return { kind: "product_search", query: named.name };

  // Service questions first: "Do you do beard trims?" names a
  // service, not a product, and must reach retrieval.
  if (SERVICE_WORDS.test(lower)) return { kind: "none" };

  // "Do you sell shampoo?" / "What products do you have?"
  if (
    /\b(products?|shop|sell|stock)\b/.test(lower) ||
    PRODUCT_WORDS.some((w) => lower.includes(w))
  ) {
    return { kind: "product_search", query: message };
  }

  return { kind: "none" };
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
  if (name === "searchProducts") {
    const action = searchProducts(
      typeof args.query === "string" ? args.query : ""
    );
    return { action, summary: actionToText(action) };
  }
  if (name === "recommendProduct") {
    const action = recommendProduct(
      typeof args.need === "string" ? args.need : ""
    );
    return { action, summary: actionToText(action) };
  }
  if (name === "addToCart") {
    const action = addToCart({
      productId: typeof args.productId === "string" ? args.productId : undefined,
      productName:
        typeof args.productName === "string" ? args.productName : undefined,
      quantity: args.quantity,
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
    case "products":
      if (action.products.length === 0) {
        return `I don't have a product matching "${action.query}" in the shop at the moment. The full range is on the shop page — or ask in the studio.`;
      }
      return (
        "In the shop: " +
        action.products.map((p) => productPriceLine(p)).join("; ") +
        "."
      );
    case "product_recommendation": {
      const p = action.product;
      const price = p.salePrice
        ? `${p.salePrice} (was ${p.price}, ${p.discount})`
        : p.price;
      return `I'd suggest the ${p.name} (${price}): ${action.reason}`;
    }
    case "cart_added":
      return `Added ${action.productName} × ${action.quantity} to your cart — view it on the shop page.`;
    case "cart_failed":
      return action.reason;
    case "product_failed":
      return action.reason;
  }
}

// OpenAI function definitions (gpt-4o-mini). The model sees exactly
// these six tools and nothing else — it cannot invent a service,
// a slot, a stylist or a product price, because the tools validate
// server-side.
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
  {
    type: "function",
    function: {
      name: "searchProducts",
      description:
        "Search the shop catalogue by name, category or keyword. Returns matching products with their real prices, including sale prices. Use it for any question about what the shop sells or what a product costs.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The product name, category or keyword, e.g. 'colour-care shampoo' or 'beard'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommendProduct",
      description:
        "Recommend one shop product for a stated need, e.g. coloured hair, dry hair, beard care. Returns the product with a one-line reason tied to its description. Never recommend a product that is out of stock — the tool picks an in-stock alternative itself.",
      parameters: {
        type: "object",
        properties: {
          need: {
            type: "string",
            description: "The visitor's need in their own words, e.g. 'coloured hair' or 'dry ends'.",
          },
        },
        required: ["need"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addToCart",
      description:
        "Add a product to the visitor's cart. Validates server-side: the product must exist, be in the shop and be in stock, and the quantity must be 1–99. Returns an addToCart action the chat widget applies to the cart — never claim the product is in the cart unless the tool succeeded.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The product id (slug), e.g. 'colour-care-mask', when known.",
          },
          productName: {
            type: "string",
            description: "The product name when the id is not known, e.g. 'Colour-care mask'.",
          },
          quantity: {
            type: "integer",
            description: "How many, 1–99. Defaults to 1.",
          },
        },
        required: [],
      },
    },
  },
];

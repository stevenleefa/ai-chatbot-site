// Sample data for Test Admin Mode (demo mode) — what a recruiter
// sees when they browse the owner area with no real account.
//
// Everything here is fictional and derived from the same sample
// sources the owner pages already use: the fictional regulars in
// lib/customers.ts (names, emails, services), the seed reviews in
// lib/reviews.ts, and the shop catalogue in lib/products.ts (prices
// are looked up, never hardcoded, so demo orders can never disagree
// with the shop). No Supabase import and no real customer data —
// demo mode never reads the leads, orders, reviews or profiles
// tables, so a visitor who sets the demo cookie by hand only ever
// gets this file. Pure data, so it runs in Jest too.
//
// The dashboard, customers, appointments and employees pages already
// use sample data (lib/dashboard.ts, lib/customers.ts,
// lib/employees.ts) and need nothing here. This file covers the pages
// that normally read Supabase: /leads, /orders, and the /admin users
// and review-approval lists.
import { getCustomerSummaries } from "./customers";
import { PRODUCTS } from "./products";
import { SEED_REVIEWS } from "./reviews";
import { BUSINESS_SLUG, type Lead, type LeadStatus } from "./leads";
import type { PendingReview } from "./reviews-server";
import type { Profile } from "./auth/session";

// --- Sample leads (/leads, /api/leads, CSV export) ---------------------------
//
// One booking request per regular (the first eight), plus one repeat
// from Emma Thompson so the table's "2nd enquiry from this contact"
// line shows. Each lead asks about the service that regular is next
// due for, so the service is one they have actually had. Dates are
// October 2026, newest first — the same shape the real page builds
// (repeatCount grouped by contact), so the table, sorting and CSV
// export behave identically in demo mode.
const LEAD_MESSAGES: Record<string, string> = {
  Haircut:
    "Hi — could I book a haircut for next week? Mornings work best.",
  "Full colour":
    "I'd like to book a full colour — could you check what shades you have?",
  Balayage:
    "Interested in a balayage. How long does it usually take?",
  "Beard trim":
    "Quick beard trim — do you have anything this Saturday?",
};

function buildSampleLeads(): Lead[] {
  const summaries = getCustomerSummaries();
  const dates = [
    "2026-10-28",
    "2026-10-27",
    "2026-10-26",
    "2026-10-24",
    "2026-10-22",
    "2026-10-20",
    "2026-10-18",
    "2026-10-15",
  ];
  const statuses: LeadStatus[] = [
    "new",
    "contacted",
    "new",
    "booked",
    "new",
    "contacted",
    "new",
    "cancelled",
  ];
  const leads: Lead[] = summaries.slice(0, 8).map((s, i) => ({
    id: `demo-lead-${s.customer.id}`,
    created_at: `${dates[i]}T10:00:00.000Z`,
    business: BUSINESS_SLUG,
    name: s.customer.name,
    contact: s.customer.email,
    service: s.nextDueService,
    message:
      LEAD_MESSAGES[s.nextDueService] ??
      "I'd like to book an appointment, please.",
    status: statuses[i],
  }));
  // Emma Thompson enquired before, so her repeat count shows in the
  // table like a real returning customer.
  const emma = summaries[0];
  leads.push({
    id: `demo-lead-${emma.customer.id}-earlier`,
    created_at: "2026-09-15T11:30:00.000Z",
    business: BUSINESS_SLUG,
    name: emma.customer.name,
    contact: emma.customer.email,
    service: emma.nextDueService,
    message:
      LEAD_MESSAGES[emma.nextDueService] ??
      "I'd like to book an appointment, please.",
    status: "booked",
  });
  const counts = new Map<string, number>();
  for (const l of leads) {
    counts.set(l.contact, (counts.get(l.contact) ?? 0) + 1);
  }
  return leads
    .map((l) => ({ ...l, repeatCount: counts.get(l.contact) ?? 1 }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const SAMPLE_LEADS: Lead[] = buildSampleLeads();

// --- Sample orders (/orders) -------------------------------------------------
//
// Four shop orders from the fictional regulars, priced from the shop
// catalogue (PRODUCTS) so the totals always tie out. stripe_session_id
// is null — these were never a real Stripe checkout. Same shape as
// the owner orders page's Order type, so the page renders them
// through its normal table.
export type SampleOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  items: { id: string; name: string; price_cents: number; quantity: number }[];
  total_cents: number;
  stripe_session_id: string | null;
  status: "pending" | "paid" | "cancelled";
};

function orderItems(
  names: string[]
): SampleOrder["items"] {
  return names.map((name) => {
    const product = PRODUCTS.find((p) => p.name === name);
    if (!product) {
      throw new Error(`Demo order references unknown product: ${name}`);
    }
    return {
      id: product.id,
      name: product.name,
      price_cents: product.priceCents,
      quantity: 1,
    };
  });
}

function sampleOrder(
  id: string,
  createdAt: string,
  customerName: string,
  customerEmail: string,
  productNames: string[],
  status: SampleOrder["status"]
): SampleOrder {
  const items = orderItems(productNames);
  return {
    id,
    created_at: createdAt,
    customer_name: customerName,
    customer_email: customerEmail,
    items,
    total_cents: items.reduce((sum, item) => sum + item.price_cents, 0),
    stripe_session_id: null,
    status,
  };
}

export const SAMPLE_ORDERS: SampleOrder[] = [
  sampleOrder(
    "demo-order-1",
    "2026-10-22T14:20:00.000Z",
    "Emma Thompson",
    "emma.thompson@example.com",
    ["Colour-care shampoo", "Colour-care mask"],
    "paid"
  ),
  sampleOrder(
    "demo-order-2",
    "2026-10-20T11:05:00.000Z",
    "Noah Patel",
    "noah.patel@example.com",
    ["Styling gel", "Leave-in treatment"],
    "paid"
  ),
  sampleOrder(
    "demo-order-3",
    "2026-10-08T09:40:00.000Z",
    "Liam O'Connor",
    "liam.oconnor@example.com",
    ["Beard oil"],
    "pending"
  ),
  sampleOrder(
    "demo-order-4",
    "2026-09-03T15:15:00.000Z",
    "Grace Liu",
    "grace.liu@example.com",
    ["Shampoo (1L)", "Conditioner (1L)"],
    "paid"
  ),
];

// --- Sample users (/admin Users list) ----------------------------------------
//
// The studio's staff from lib/dashboard.ts (Maya the owner, Sofia and
// Amelia on staff) plus Emma Thompson as a customer, so the list shows
// all three roles. Fictional addresses on the business's example
// domain — never a real person's email.
export const SAMPLE_PROFILES: Profile[] = [
  {
    id: "demo-profile-maya-chen",
    email: "maya.chen@lumenhairstudio.example",
    role: "admin",
    is_active: true,
    created_at: "2026-08-01",
  },
  {
    id: "demo-profile-sofia-reyes",
    email: "sofia.reyes@lumenhairstudio.example",
    role: "staff",
    is_active: true,
    created_at: "2026-08-05",
  },
  {
    id: "demo-profile-amelia-brooks",
    email: "amelia.brooks@lumenhairstudio.example",
    role: "staff",
    is_active: true,
    created_at: "2026-08-12",
  },
  {
    id: "demo-profile-emma-thompson",
    email: "emma.thompson@example.com",
    role: "customer",
    is_active: true,
    created_at: "2026-09-02",
  },
];

// --- Sample pending reviews (/admin Review approvals) ------------------------
//
// The first three seed reviews (lib/reviews.ts), shown as pending so
// the approvals list is not empty in demo mode. They are the same
// fictional reviews the homepage already shows as seeds — in demo
// mode the Approve/Delete buttons are disabled, so nothing about
// them can change.
export const SAMPLE_PENDING_REVIEWS: PendingReview[] = SEED_REVIEWS.slice(
  0,
  3
).map((s) => ({
  id: `demo-pending-${s.id}`,
  name: s.name,
  rating: s.rating,
  text: s.text,
  service: s.service,
  created_at: s.createdAt,
}));

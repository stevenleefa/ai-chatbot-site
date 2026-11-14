// Shared leads helpers. One Supabase project serves both demos;
// rows are separated by the `business` column ("salon" / "plumbing").
// This project is the "salon" business. No payment details are ever stored.
export const BUSINESS_SLUG = "salon" as const;
export const BUSINESS_NAME = "Lumen Hair Studio";

export const LEAD_STATUSES = ["new", "contacted", "booked", "cancelled"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Lead = {
  id: string;
  created_at: string;
  business: string;
  name: string;
  contact: string;
  service: string;
  message: string | null;
  status: LeadStatus;
  appointment_at?: string | null; // rescheduled date/time (null = never rescheduled; the original booking date/time lives in the message text)
  repeatCount?: number;
};

export function isValidStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

// --- Shared lead save ---------------------------------------------------------
//
// The ONE place a lead is persisted — used by the booking form
// (app/api/lead/route.ts) and by the chatbot's createBooking tool
// (lib/tools.ts), so both go through the same validation, duplicate
// protection and demo-mode behaviour. Callers keep their own rate
// limits and their own automation events: saveLead only persists
// (or honestly reports that it did not).
//
// Demo mode (Supabase unconfigured): nothing is persisted and the
// result says saved:false — the caller must say so in its reply
// instead of pretending the request was stored.

import { getServerSupabase, isSupabaseConfigured } from "./supabase";

export type SaveLeadInput = {
  name: string;
  contact: string;
  service: string;
  message?: string;
};

export type SaveLeadResult = {
  ok: boolean;
  saved: boolean;
  duplicate?: boolean;
  error?: string;
};

const MAX_NAME = 100;
const MAX_CONTACT = 100;
const MAX_SERVICE = 100;
const MAX_MESSAGE = 2000;

export async function saveLead(
  input: SaveLeadInput
): Promise<SaveLeadResult> {
  const { name, contact, service, message } = input;
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > MAX_NAME ||
    typeof contact !== "string" ||
    contact.length === 0 ||
    contact.length > MAX_CONTACT ||
    typeof service !== "string" ||
    service.length === 0 ||
    service.length > MAX_SERVICE ||
    (message !== undefined && message !== null &&
      (typeof message !== "string" || message.length > MAX_MESSAGE))
  ) {
    return { ok: false, saved: false, error: "Invalid lead fields." };
  }

  if (!isSupabaseConfigured()) {
    console.log("New lead received but not saved — Supabase not configured.");
    return { ok: true, saved: false };
  }

  const supabase = getServerSupabase();
  // Safety net for a double-click / double-submit that slips past the
  // disabled button: if the exact same lead (same name, contact,
  // service and message) was already saved in the last 60 seconds,
  // don't insert it again — the booking already exists.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase!
    .from("leads")
    .select("created_at, message")
    .eq("business", BUSINESS_SLUG)
    .eq("name", name)
    .eq("contact", contact)
    .eq("service", service)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  const duplicate = (recent ?? []).find(
    (row) => (row.message ?? "") === (message ?? "")
  );
  if (duplicate) {
    return { ok: true, saved: true, duplicate: true };
  }

  const { error } = await supabase!
    .from("leads")
    .insert({
      business: BUSINESS_SLUG,
      name,
      contact,
      service,
      message: message ?? null,
      status: "new",
    });
  if (error) {
    // Never leak Supabase error details (or keys) to the caller.
    console.error("Failed to save lead:", error.message);
    return { ok: false, saved: false, error: "Could not save the lead." };
  }
  return { ok: true, saved: true };
}

// CSV: quote any field containing a comma, quote or newline, doubling quotes.
// CSV-injection defence: a field starting with =, +, -, @, tab or
// carriage return can be read as a formula by Excel/Sheets when the
// owner opens the export (e.g. a lead named "=cmd|..."). Prefixing a
// single quote makes the cell plain text — the quote is how the
// spreadsheet itself shows "this is text, not a formula".
export function csvEscape(value: string | null | undefined): string {
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = "created_at,name,contact,service,message,status";
  const rows = leads.map((l) =>
    [l.created_at, l.name, l.contact, l.service, l.message, l.status]
      .map(csvEscape)
      .join(",")
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}

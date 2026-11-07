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
  repeatCount?: number;
};

export function isValidStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

// --- v1 owner protection (NOT full auth) ---
// If LEADS_OWNER_TOKEN is set, the owner pages/APIs require it, passed as
// ?token=... or the x-leads-owner-token header (or Authorization: Bearer ...).
// If it is NOT set, access is allowed but /leads shows a clear warning
// that the list is unprotected in demo mode. For a real client, replace
// this with proper auth (e.g. Supabase Auth) before going live.
export function ownerTokenIsSet(): boolean {
  return Boolean(process.env.LEADS_OWNER_TOKEN);
}

export function ownerTokenMatches(token: string | null | undefined): boolean {
  const expected = process.env.LEADS_OWNER_TOKEN;
  if (!expected) return true; // demo mode: unprotected, warned about on /leads
  return Boolean(token) && token === expected;
}

export function ownerTokenFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;
  const fromHeader = req.headers.get("x-leads-owner-token");
  if (fromHeader) return fromHeader;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7);
  return null;
}

export function requireOwner(req: Request): boolean {
  return ownerTokenMatches(ownerTokenFromRequest(req));
}

// CSV: quote any field containing a comma, quote or newline, doubling quotes.
export function csvEscape(value: string | null | undefined): string {
  const s = value ?? "";
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

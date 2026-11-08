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

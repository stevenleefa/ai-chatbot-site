// Customer-area data: a signed-in customer's own bookings and orders.
// Both are read server-side with the service-role client (which
// bypasses RLS — the orders and leads tables have no public policies),
// filtered by the email from the verified session, never by anything
// the visitor typed. The caller passes the session email in; these
// helpers never read it from a request.
//
// Matching is by email, case-insensitively: the booking form's contact
// field holds "phone or email", and the shop stores the checkout email
// as typed (trimmed, not lowercased), so `.ilike` is what makes
// "Alex@Example.com" match "alex@example.com". The email is escaped
// first because ilike treats % and _ as wildcards (both are legal in
// the local part of an email address, however rare).
// Known limit: a booking made with a phone number instead of the
// account email cannot be matched to the account, so it does not
// appear here. /my-account says so on the page.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUSINESS_SLUG, type Lead } from "./leads";

export type CustomerOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  items: { id: string; name: string; price_cents: number; quantity: number }[];
  total_cents: number;
  status: "pending" | "paid" | "cancelled";
};

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

// The customer's bookings: leads for this business whose contact
// field is their email. Newest first. A query error (or an
// unconfigured client) returns an empty list, never a crash — the
// page shows its "no bookings yet" state instead.
export async function getCustomerBookings(
  supabase: SupabaseClient,
  email: string
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id,created_at,business,name,contact,service,message,status")
    .eq("business", BUSINESS_SLUG)
    .ilike("contact", escapeIlike(email))
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Lead[];
}

// The customer's shop orders: orders for this business whose
// customer_email is their email. Newest first.
export async function getCustomerOrders(
  supabase: SupabaseClient,
  email: string
): Promise<CustomerOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,created_at,customer_name,customer_email,items,total_cents,status"
    )
    .eq("business", BUSINESS_SLUG)
    .ilike("customer_email", escapeIlike(email))
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as CustomerOrder[];
}

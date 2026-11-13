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
    .select("id,created_at,business,name,contact,service,message,status,appointment_at")
    .eq("business", BUSINESS_SLUG)
    .ilike("contact", escapeIlike(email))
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Lead[];
}

// One of the customer's own bookings, by id — the ownership check
// the reschedule/cancel routes use. Returns null unless the lead is
// a salon lead AND its contact matches the session email (same
// ilike + escaping as getCustomerBookings), so a customer can never
// reschedule or cancel someone else's booking by guessing its id.
export async function getCustomerBookingById(
  supabase: SupabaseClient,
  email: string,
  id: string
): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("id,created_at,business,name,contact,service,message,status,appointment_at")
    .eq("business", BUSINESS_SLUG)
    .ilike("contact", escapeIlike(email))
    .eq("id", id)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as Lead;
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

// --- My bookings: reschedule / cancel ---------------------------------------
//
// Both check ownership first through getCustomerBookingById (same
// ilike + business filter), so a customer can only ever change
// their own booking — an id that is not theirs comes back as null
// and the route answers 404 without revealing whether it exists
// for someone else. The routes validate the new date/time before
// calling reschedule (see lib/reschedule.ts); these helpers only
// write. Neither changes the lead message string — the original
// booking date/time stays there, and appointment_at carries the
// new one (the /leads list prefers it when present).

// Move the customer's own booking to a new date/time. Returns the
// updated lead, or null when the booking is not theirs (or the
// update failed).
export async function rescheduleCustomerBooking(
  supabase: SupabaseClient,
  email: string,
  id: string,
  appointmentAt: string
): Promise<Lead | null> {
  const booking = await getCustomerBookingById(supabase, email, id);
  if (!booking) return null;
  const { data, error } = await supabase
    .from("leads")
    .update({ appointment_at: appointmentAt })
    .eq("business", BUSINESS_SLUG)
    .eq("id", id)
    .select("id,created_at,business,name,contact,service,message,status,appointment_at")
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as Lead;
}

// Cancel the customer's own booking (status -> 'cancelled').
// Returns the updated lead, or null when the booking is not theirs
// (or the update failed). Cancelling an already-cancelled booking
// is a no-op success — the route answers ok without writing again.
export async function cancelCustomerBooking(
  supabase: SupabaseClient,
  email: string,
  id: string
): Promise<Lead | null> {
  const booking = await getCustomerBookingById(supabase, email, id);
  if (!booking) return null;
  if (booking.status === "cancelled") return booking;
  const { data, error } = await supabase
    .from("leads")
    .update({ status: "cancelled" })
    .eq("business", BUSINESS_SLUG)
    .eq("id", id)
    .select("id,created_at,business,name,contact,service,message,status,appointment_at")
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as Lead;
}

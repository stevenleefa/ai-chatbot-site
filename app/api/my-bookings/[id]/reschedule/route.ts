import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSession } from "@/lib/auth/session";
import {
  getCustomerBookingById,
  rescheduleCustomerBooking,
} from "@/lib/customer-account";
import { validateReschedule } from "@/lib/reschedule";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Move one of the customer's OWN bookings to a new date + time
// (body { date: "YYYY-MM-DD", time: "HH:MM" }). The new date/time
// is stored in the lead's appointment_at — the original booking
// date/time stays in the message text, and the /leads list prefers
// appointment_at when present. The email always comes from the
// verified session, ownership is checked with
// getCustomerBookingById (404 for a booking that is not theirs),
// and the date/time are re-validated server-side (future date,
// Mon–Sat, 09:00–18:00) — the client form enforces the same rules,
// but the server never trusts it.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { error: "That request is too large." },
      { status: 413 }
    );
  }
  const ip = clientIp(req);
  const limit = rateLimit(`my-bookings:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Bookings storage is not configured." },
      { status: 503 }
    );
  }
  const supabase = getServerSupabase();
  const booking = await getCustomerBookingById(
    supabase!,
    session.profile.email,
    params.id
  );
  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found." },
      { status: 404 }
    );
  }
  const fields =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const validation = validateReschedule(fields.date, fields.time);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }
  const updated = await rescheduleCustomerBooking(
    supabase!,
    session.profile.email,
    params.id,
    validation.appointmentAt
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Could not reschedule this booking." },
      { status: 500 }
    );
  }
  revalidatePath("/my-account");
  return NextResponse.json({ ok: true, booking: updated });
}

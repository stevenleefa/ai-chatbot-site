import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSession } from "@/lib/auth/session";
import {
  cancelCustomerBooking,
  getCustomerBookingById,
} from "@/lib/customer-account";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Cancel one of the customer's OWN bookings (status -> 'cancelled').
// The email always comes from the verified session — never from the
// request — and ownership is checked with getCustomerBookingById:
// a booking that is not theirs answers 404, without revealing
// whether it exists for someone else. Body-capped + rate-limited
// like /api/lead.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { tooLarge } = await readCappedJson(req);
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
  const updated = await cancelCustomerBooking(
    supabase!,
    session.profile.email,
    params.id
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Could not cancel this booking." },
      { status: 500 }
    );
  }
  revalidatePath("/my-account");
  return NextResponse.json({ ok: true, booking: updated });
}

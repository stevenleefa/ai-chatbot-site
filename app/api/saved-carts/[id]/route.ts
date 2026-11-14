import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase";
import { deleteSavedCart } from "@/lib/saved-carts";
import { clientIp, rateLimit } from "@/lib/security";

// Delete one of the signed-in customer's saved carts. Ownership is
// checked by the session email inside deleteSavedCart — a cart that
// is not theirs answers 404, without revealing whether it exists
// for someone else.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ip = clientIp(req);
  const limit = rateLimit(`saved-carts:${ip}`, 10, 60_000);
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
      {
        configured: false,
        error: "Saved carts are not set up yet.",
      },
      { status: 503 }
    );
  }
  const deleted = await deleteSavedCart(session.profile.email, params.id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Saved cart not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}

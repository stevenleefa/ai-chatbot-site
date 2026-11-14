import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  listSavedCarts,
  saveCart,
  validateSavedCartItems,
} from "@/lib/saved-carts";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Saved carts for the signed-in customer (see lib/saved-carts.ts).
// GET lists theirs, newest first. When Supabase is unconfigured
// the route answers { configured: false, carts: [] } so the client
// knows to use the on-device (localStorage) fallback instead of
// showing an error. POST saves one cart under a label of their
// choosing. Both use the email from the verified session only.

const MAX_NAME = 100;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, carts: [] });
  }
  const carts = await listSavedCarts(session.profile.email);
  return NextResponse.json({ configured: true, carts });
}

export async function POST(req: Request) {
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { error: "That request is too large." },
      { status: 413 }
    );
  }
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
        error: "Saved carts are not set up yet — the cart was not saved to your account.",
      },
      { status: 503 }
    );
  }
  const fields =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const items = validateSavedCartItems(fields.items);
  if (name.length === 0 || name.length > MAX_NAME || !items) {
    return NextResponse.json(
      {
        error:
          "A cart name (1–100 characters) and 1–20 items with quantities 1–99 are required.",
      },
      { status: 400 }
    );
  }
  const saved = await saveCart(session.profile.email, name, items);
  if (!saved) {
    return NextResponse.json(
      { error: "Could not save this cart." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, cart: saved });
}

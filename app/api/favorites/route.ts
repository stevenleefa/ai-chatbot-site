import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  addFavorite,
  isValidFavoriteProductId,
  listFavoriteProductIds,
  removeFavorite,
} from "@/lib/favorites";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Favorite products for the signed-in customer (see lib/favorites.ts
// and supabase/user-favorites-schema.sql). GET lists their favorite
// product ids, oldest first. POST favorites one product, DELETE
// removes one — both take { productId } and answer with the updated
// list, so the client never has to re-fetch. Unknown product ids
// are rejected with 400. Everything is keyed by the verified
// session user id — the client is never trusted for it. When
// Supabase is unconfigured the route answers { configured: false }
// so the client says so instead of showing an error.

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, favorites: [] });
  }
  const favorites = await listFavoriteProductIds(session.user.id);
  return NextResponse.json({ configured: true, favorites });
}

export async function POST(req: Request) {
  return writeFavorite(req, "add");
}

export async function DELETE(req: Request) {
  return writeFavorite(req, "remove");
}

async function writeFavorite(req: Request, action: "add" | "remove") {
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { error: "That request is too large." },
      { status: 413 },
    );
  }
  const ip = clientIp(req);
  const limit = rateLimit(`favorites:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
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
        error:
          "Favorites are not set up yet — the favorite was not saved to your account.",
      },
      { status: 503 },
    );
  }
  const fields =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const productId = fields.productId;
  if (!isValidFavoriteProductId(productId)) {
    return NextResponse.json(
      { error: "That product does not exist." },
      { status: 400 },
    );
  }
  const ok =
    action === "add"
      ? await addFavorite(session.user.id, productId as string)
      : await removeFavorite(session.user.id, productId as string);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not save this favorite." },
      { status: 500 },
    );
  }
  const favorites = await listFavoriteProductIds(session.user.id);
  return NextResponse.json({ ok: true, favorites });
}

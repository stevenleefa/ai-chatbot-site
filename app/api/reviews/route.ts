import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getPublicReviews } from "@/lib/reviews-server";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Public reviews API. GET returns the approved visitor reviews plus
// the seed reviews, newest first. POST saves a new review as
// "pending" — it only appears on the site once an admin approves it
// on /admin (see REVIEWS.md). Validation + rate limiting follow the
// /api/lead pattern: body capped, fields type-checked and
// length-capped, no links in the text (a simple spam control).
export async function GET() {
  const reviews = await getPublicReviews();
  return NextResponse.json({ reviews });
}

export async function POST(req: Request) {
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { error: "That review is too long." },
      { status: 413 }
    );
  }

  const ip = clientIp(req);
  const limit = rateLimit(`review:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many reviews — please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const fields =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const { name, rating, text, service } = fields;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > 100
  ) {
    return NextResponse.json(
      { error: "Add your name (under 100 characters)." },
      { status: 400 }
    );
  }
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return NextResponse.json(
      { error: "Choose a rating from 1 to 5 stars." },
      { status: 400 }
    );
  }
  if (
    typeof text !== "string" ||
    text.trim().length === 0 ||
    text.length > 1000
  ) {
    return NextResponse.json(
      { error: "Write a review (under 1,000 characters)." },
      { status: 400 }
    );
  }
  if (/https?:\/\//i.test(text)) {
    return NextResponse.json(
      { error: "Links are not allowed in reviews." },
      { status: 400 }
    );
  }
  if (
    service !== undefined &&
    service !== null &&
    (typeof service !== "string" || service.length > 100)
  ) {
    return NextResponse.json(
      { error: "The service must be under 100 characters." },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      saved: false,
      message:
        "Thanks! Reviews are not being saved yet — the studio has not set up review storage — but your kind words are noted.",
    });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase!.from("reviews").insert({
    name: name.trim(),
    rating,
    text: text.trim(),
    service:
      typeof service === "string" && service.trim()
        ? service.trim()
        : null,
    status: "pending",
  });
  if (error) {
    // Never leak Supabase error details to the client.
    console.error("Failed to save review:", error.message);
    return NextResponse.json(
      { error: "Could not save your review. Please try again later." },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    saved: true,
    message: "Thanks — your review will appear once the studio approves it.",
  });
}

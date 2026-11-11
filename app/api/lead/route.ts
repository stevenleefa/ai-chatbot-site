import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { BUSINESS_SLUG } from "@/lib/leads";
import {
  clientIp,
  rateLimit,
  readCappedJson,
} from "@/lib/security";

// Lead capture. If Supabase is configured, the lead is saved to the
// shared `leads` table (business = "salon"). If not, it falls back to
// a log line and the response says so (saved: false) — the site still
// works in demo mode. Do not store payment details here.
//
// Hardening (see SECURITY.md): the body is size-capped, each field is
// type-checked and length-capped (an uncapped public form is a free
// way to stuff the database), and a per-IP fixed-window rate limit
// (10/min) blunts floods. The unconfigured branch logs only that a
// lead arrived — never the visitor's name, contact or message, so no
// personal data lands in server logs.
const MAX_NAME = 100;
const MAX_CONTACT = 100;
const MAX_SERVICE = 100;
const MAX_MESSAGE = 2000;

function isField(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export async function POST(req: Request) {
  // The cap covers chunked bodies too (readCappedJson reads the raw
  // body and measures its bytes — a chunked request carries no
  // content-length header, so a header-only check would miss it).
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { error: "That request is too large." },
      { status: 413 }
    );
  }

  const ip = clientIp(req);
  const limit = rateLimit(`lead:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many booking requests — please wait a moment and try again." },
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
  const { name, contact, service, message } = fields;
  if (
    !isField(name, MAX_NAME) ||
    !isField(contact, MAX_CONTACT) ||
    !isField(service, MAX_SERVICE)
  ) {
    return NextResponse.json(
      { error: "Name, contact and service are required (each under 100 characters)." },
      { status: 400 }
    );
  }
  if (message !== undefined && message !== null && typeof message !== "string") {
    return NextResponse.json(
      { error: "The message must be text." },
      { status: 400 }
    );
  }
  if (typeof message === "string" && message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: "The message must be under 2,000 characters." },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    console.log("New lead received but not saved — Supabase not configured.");
    return NextResponse.json({
      ok: true,
      saved: false,
      message:
        "Thanks! The studio will confirm your booking request shortly. Note: this enquiry was not saved yet — lead storage is not set up.",
    });
  }

  const supabase = getServerSupabase();
  // Safety net for a double-click / double-submit that slips past the
  // disabled button: if the exact same lead (same name, contact,
  // service and message) was already saved in the last 60 seconds,
  // don't insert it again — just say thanks as if it saved.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase!
    .from("leads")
    .select("created_at, message")
    .eq("business", BUSINESS_SLUG)
    .eq("name", name)
    .eq("contact", contact)
    .eq("service", service)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  const duplicate = (recent ?? []).find(
    (row) => (row.message ?? "") === (message ?? "")
  );
  if (duplicate) {
    return NextResponse.json({
      ok: true,
      saved: true,
      duplicate: true,
      message: "Thanks! The studio will confirm your booking request shortly.",
    });
  }

  const { error } = await supabase!
    .from("leads")
    .insert({
      business: BUSINESS_SLUG,
      name,
      contact,
      service,
      message: message ?? null,
      status: "new",
    });
  if (error) {
    // Never leak Supabase error details (or keys) to the client.
    console.error("Failed to save lead:", error.message);
    return NextResponse.json(
      { error: "Could not save your request. Please call us instead." },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    saved: true,
    message: "Thanks! The studio will confirm your booking request shortly.",
  });
}

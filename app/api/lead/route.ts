import { NextResponse } from "next/server";
import { saveLead } from "@/lib/leads";
import { emitEvent } from "@/lib/events";
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

  // Persistence (including the 60-second duplicate protection and
  // the demo-mode saved:false branch) lives in lib/leads.ts, shared
  // with the chatbot's createBooking tool — this route keeps only
  // its own validation, rate limit and automation events.
  const result = await saveLead({
    name,
    contact,
    service,
    message: typeof message === "string" ? message : undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "Could not save your request. Please call us instead." },
      { status: 500 }
    );
  }
  if (result.duplicate) {
    // Already saved in the last 60 seconds: say thanks as if it
    // saved. The duplicate branch does NOT emit events — the
    // original submit already did.
    return NextResponse.json({
      ok: true,
      saved: true,
      duplicate: true,
      message: "Thanks! The studio will confirm your booking request shortly.",
    });
  }
  // Saved (or accepted in demo mode with saved:false): one booking
  // request is both a new lead (CRM) and a new appointment (diary),
  // so both events fire. Fire-and-forget — the response does not
  // wait for n8n.
  const event = { saved: result.saved, name, contact, service, message: message ?? undefined };
  void emitEvent("lead.created", event);
  void emitEvent("appointment.booked", event);
  return NextResponse.json({
    ok: true,
    saved: result.saved,
    message: result.saved
      ? "Thanks! The studio will confirm your booking request shortly."
      : "Thanks! The studio will confirm your booking request shortly. Note: this enquiry was not saved yet — lead storage is not set up.",
  });
}

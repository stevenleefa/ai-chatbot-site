import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { BUSINESS_SLUG } from "@/lib/leads";

// Lead capture. If Supabase is configured, the lead is saved to the
// shared `leads` table (business = "salon"). If not, it falls back to
// console.log and the response says so (saved: false) — the site still
// works in demo mode. Do not store payment details here.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { name, contact, service, message } = body;
  if (!name || !contact || !service) {
    return NextResponse.json(
      { error: "Name, contact and service are required." },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    console.log("New lead (not saved — Supabase not configured):", {
      business: BUSINESS_SLUG,
      name,
      contact,
      service,
      message,
    });
    return NextResponse.json({
      ok: true,
      saved: false,
      message:
        "Thanks! The studio will confirm your booking request shortly. Note: this enquiry was not saved yet — lead storage is not set up.",
    });
  }

  const supabase = getServerSupabase();
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

import { NextResponse } from "next/server";

// Demo lead capture. In production, replace the console.log with a real
// insert — e.g. Supabase (free tier) or an email service — and add spam
// protection. Do not store payment details here.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { name, contact, service, message } = body;
  if (!name || !contact || !service) {
    return NextResponse.json(
      { error: "Name, contact and service are required." },
      { status: 400 }
    );
  }
  console.log("New lead:", { name, contact, service, message });
  return NextResponse.json({
    ok: true,
    message: "Thanks! The studio will confirm your booking request shortly.",
  });
}

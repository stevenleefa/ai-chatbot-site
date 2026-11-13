import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getDemoOrSession } from "@/lib/auth/demo";
import { BUSINESS_SLUG, isValidStatus } from "@/lib/leads";

// Owner-only: change one lead's status. Only updates a lead belonging
// to this business (business filter on the update).
// Test Admin Mode: status changes are disabled in demo mode — a demo
// visitor gets a 403 and nothing is written.
export async function POST(req: Request) {
  const { demo, session } = await getDemoOrSession();
  if (demo) {
    return NextResponse.json(
      { error: "Demo mode — status changes are disabled." },
      { status: 403 }
    );
  }
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  // Defence in depth behind the middleware: a customer must never
  // change a lead's status.
  if (session.profile.role === "customer") {
    return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { id, status } = body;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 100 ||
    !isValidStatus(status)
  ) {
    return NextResponse.json(
      { error: "A lead id and a valid status (new, contacted, booked, cancelled) are required." },
      { status: 400 }
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Leads storage is not configured." },
      { status: 503 }
    );
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase!
    .from("leads")
    .update({ status })
    .eq("id", id)
    .eq("business", BUSINESS_SLUG)
    .select("id,status");
  if (error) {
    console.error("Failed to update lead status:", error.message);
    return NextResponse.json({ error: "Could not update lead." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lead: data[0] });
}

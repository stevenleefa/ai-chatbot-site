import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { BUSINESS_SLUG, isValidStatus, requireOwner } from "@/lib/leads";

// Owner-only: change one lead's status. Only updates a lead belonging
// to this business (business filter on the update).
export async function POST(req: Request) {
  if (!requireOwner(req)) {
    return NextResponse.json({ error: "Owner token required." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { id, status } = body;
  if (!id || !isValidStatus(status)) {
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

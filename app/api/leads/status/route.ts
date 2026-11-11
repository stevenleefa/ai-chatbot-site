import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSession } from "@/lib/auth/session";
import { BUSINESS_SLUG, isValidStatus } from "@/lib/leads";

// Owner-only: change one lead's status. Only updates a lead belonging
// to this business (business filter on the update).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
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

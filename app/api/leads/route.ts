import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { BUSINESS_SLUG, requireOwner } from "@/lib/leads";

// Owner-only: list this business's leads, newest first.
// Requires LEADS_OWNER_TOKEN (?token= / header) when it is set.
export async function GET(req: Request) {
  if (!requireOwner(req)) {
    return NextResponse.json({ error: "Owner token required." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, configured: false, leads: [] });
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase!
    .from("leads")
    .select("id,created_at,business,name,contact,service,message,status")
    .eq("business", BUSINESS_SLUG)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to list leads:", error.message);
    return NextResponse.json({ error: "Could not load leads." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, configured: true, leads: data ?? [] });
}

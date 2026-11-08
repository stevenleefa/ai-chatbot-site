import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSession } from "@/lib/auth/session";
import { BUSINESS_SLUG } from "@/lib/leads";

// Owner-only: list this business's leads, newest first.
// Requires a signed-in account with an active staff/admin profile.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
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

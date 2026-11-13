import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getDemoOrSession } from "@/lib/auth/demo";
import { SAMPLE_LEADS } from "@/lib/demo-data";
import { BUSINESS_SLUG } from "@/lib/leads";

// Owner-only: list this business's leads, newest first.
// Requires a signed-in account with an active staff/admin profile.
// Test Admin Mode: a signed-out visitor with the demo cookie gets
// the sample leads below and never touches the real leads table.
export async function GET(req: Request) {
  const { demo, session } = await getDemoOrSession();
  if (demo) {
    return NextResponse.json({
      ok: true,
      configured: true,
      leads: SAMPLE_LEADS,
      demo: true,
    });
  }
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  // Defence in depth behind the middleware: a customer must never
  // read the owner leads list.
  if (session.profile.role === "customer") {
    return NextResponse.json({ error: "Owner access required." }, { status: 401 });
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

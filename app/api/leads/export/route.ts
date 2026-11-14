import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getDemoOrSession } from "@/lib/auth/demo";
import { SAMPLE_LEADS } from "@/lib/demo-data";
import { BUSINESS_SLUG, leadsToCsv, type Lead } from "@/lib/leads";

// Owner-only: CSV download of this business's leads, newest first.
// When Supabase is not configured, returns just the header row.
// Test Admin Mode: a signed-out visitor with the demo cookie gets a
// CSV of the sample leads and never touches the real leads table.
export async function GET(req: Request) {
  const { demo, session } = await getDemoOrSession();
  if (!demo) {
    if (!session) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    // Defence in depth behind the middleware: a customer must never
    // export the owner leads list.
    if (session.profile.role === "customer") {
      return NextResponse.json({ error: "Owner access required." }, { status: 401 });
    }
  }
  let leads: Lead[] = [];
  if (demo) {
    leads = SAMPLE_LEADS;
  } else if (isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("leads")
      .select("id,created_at,business,name,contact,service,message,status")
      .eq("business", BUSINESS_SLUG)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to export leads:", error.message);
      return NextResponse.json({ error: "Could not export leads." }, { status: 500 });
    }
    leads = (data ?? []) as Lead[];
  }
  return new NextResponse(leadsToCsv(leads), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads-salon.csv"',
    },
  });
}

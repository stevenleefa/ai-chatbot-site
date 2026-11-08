import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSession } from "@/lib/auth/session";
import { BUSINESS_SLUG, leadsToCsv, type Lead } from "@/lib/leads";

// Owner-only: CSV download of this business's leads, newest first.
// When Supabase is not configured, returns just the header row.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  let leads: Lead[] = [];
  if (isSupabaseConfigured()) {
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

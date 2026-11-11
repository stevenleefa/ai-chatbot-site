// Always fetch fresh leads: do not let Next.js cache the Supabase query
// in .next, or /leads can show a stale status after an update.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import LeadsTable from "@/components/LeadsTable";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import { BUSINESS_NAME, BUSINESS_SLUG, type Lead } from "@/lib/leads";

// Owner leads list for Lumen Hair Studio. Server component: it reads only this
// business's leads (business = "salon"), newest first.
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
export default async function LeadsPage() {
  if (!isAuthConfigured()) {
    return (
      <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
        <h1>Leads — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert" style={{ background: "#fff3cd", padding: 12 }}>
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so the leads list is hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/leads");

  let leads: Lead[] = [];
  if (isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("leads")
      .select("id,created_at,business,name,contact,service,message,status")
      .eq("business", BUSINESS_SLUG)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const counts = new Map<string, number>();
      for (const row of data) counts.set(row.contact, (counts.get(row.contact) ?? 0) + 1);
      leads = (data as Lead[]).map((row) => ({
        ...row,
        repeatCount: counts.get(row.contact) ?? 1,
      }));
    }
  }

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <h1>Leads — {BUSINESS_NAME}</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      <p>
        Signed in as <strong>{session.user.email}</strong> (
        {session.profile.role}).
      </p>
      {!isSupabaseConfigured() && (
        <p>
          Supabase is not configured, so no leads are being saved yet. See
          LEADS.md to set it up — new booking requests currently only log to
          the server console.
        </p>
      )}
      <p>
        <a href="/api/leads/export">Download CSV (leads-salon.csv)</a>
      </p>
      <LeadsTable leads={leads} />
    </main>
  );
}

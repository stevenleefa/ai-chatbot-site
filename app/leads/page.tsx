// Always fetch fresh leads: do not let Next.js cache the Supabase query
// in .next, or /leads can show a stale status after an update.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsTable from "@/components/LeadsTable";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  BUSINESS_NAME,
  BUSINESS_SLUG,
  ownerTokenIsSet,
  ownerTokenMatches,
  type Lead,
} from "@/lib/leads";

// Owner leads list for Lumen Hair Studio. Server component: it reads only this
// business's leads (business = "salon"), newest first.
// Access: /leads?token=YOUR_LEADS_OWNER_TOKEN when LEADS_OWNER_TOKEN is set.
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? null;
  const tokenSet = ownerTokenIsSet();

  if (tokenSet && !ownerTokenMatches(token)) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
        <h1>Leads — Lumen Hair Studio</h1>
        <p>Owner token required. Open this page as /leads?token=YOUR_LEADS_OWNER_TOKEN</p>
      </main>
    );
  }

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

  const exportHref = token
    ? `/api/leads/export?token=${encodeURIComponent(token)}`
    : "/api/leads/export";

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <h1>Leads — Lumen Hair Studio</h1>
      <p><a href="/">← Back to the site</a></p>
      {!tokenSet && (
        <p role="alert" style={{ background: "#fff3cd", padding: 12 }}>
          <strong>Demo mode — this list is unprotected.</strong> LEADS_OWNER_TOKEN
          is not set, so anyone who finds /leads can see it. Set
          LEADS_OWNER_TOKEN in .env.local (and later in Vercel) to require a
          token. This is a v1 demo guard, not full auth.
        </p>
      )}
      {!isSupabaseConfigured() && (
        <p>
          Supabase is not configured, so no leads are being saved yet. See
          LEADS.md to set it up — new booking requests currently only log to
          the server console.
        </p>
      )}
      <p>
        <a href={exportHref}>Download CSV (leads-salon.csv)</a>
      </p>
      <LeadsTable leads={leads} token={token} />
    </main>
  );
}

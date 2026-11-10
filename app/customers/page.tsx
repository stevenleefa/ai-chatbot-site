// Owner customers list for Lumen Hair Studio. Server component.
// Sample/demo data only — see lib/customers.ts and CUSTOMERS.md.
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import OwnerNav from "@/components/OwnerNav";
import ColourLegend from "@/components/ColourLegend";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import { fmtDate, money } from "@/lib/dashboard";
import { getCustomersSortedByDue } from "@/lib/customers";
import { BUSINESS_NAME } from "@/lib/leads";

export default async function CustomersPage() {
  if (!isAuthConfigured()) {
    return (
      <main className="dash-main">
        <h1>Customers — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert" className="demo-banner">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so the customers list is hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/customers");

  const customers = getCustomersSortedByDue();
  const nudgeCount = customers.filter((c) => c.needsNudge).length;

  return (
    <main className="dash-main">
      <h1>Customers — {BUSINESS_NAME}</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      <OwnerNav />
      <p>
        Signed in as <strong>{session.user.email}</strong> (
        {session.profile.role}).
      </p>

      <p role="note" className="demo-banner demo-banner-sample">
        <strong>Sample demo data — not a real business&apos;s figures.</strong>{" "}
        {customers.length} fictional regular customers. Each customer&apos;s
        visits are a subset of the dashboard&apos;s sample sales rows (see{" "}
        <code>lib/customers.ts</code> and <code>CUSTOMERS.md</code>).
      </p>

      <ColourLegend />

      <p>
        {nudgeCount} {nudgeCount === 1 ? "customer needs" : "customers need"}{" "}
        a nudge — due for a visit with no appointment booked. Sorted by next
        due date, soonest first.
      </p>

      <div className="table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>
                Customer{" "}
                <span className="tag tag-people">People</span>
              </th>
              <th>Contact</th>
              <th>Last visit</th>
              <th>
                Next due{" "}
                <span className="tag tag-appointments">Appointments</span>
              </th>
              <th>Status</th>
              <th className="num">Visits</th>
              <th className="num">
                Total spent{" "}
                <span className="tag tag-money">Money</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.customer.id}>
                <td>
                  <Link href={`/customers/${c.customer.id}`}>
                    {c.customer.name}
                  </Link>
                </td>
                <td>
                  {c.customer.phone}
                  <br />
                  <span className="sub">{c.customer.email}</span>
                </td>
                <td>{fmtDate(c.lastVisit)}</td>
                <td>
                  {fmtDate(c.nextDueDate)}
                  <br />
                  <span className="sub">{c.nextDueService}</span>
                </td>
                <td>
                  {c.needsNudge ? (
                    <span className="badge badge-low">Needs a nudge</span>
                  ) : (
                    <span className="badge badge-ok">Booked</span>
                  )}
                </td>
                <td className="num">{c.visits}</td>
                <td className="num">{money(c.totalSpent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// Owner appointments diary for Lumen Hair Studio. Server component.
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
import {
  getAppointments,
  getCustomerSummaries,
  getNudgeCustomers,
} from "@/lib/customers";
import { employeeIdForName } from "@/lib/employees";
import { BUSINESS_NAME } from "@/lib/leads";

export default async function AppointmentsPage() {
  if (!isAuthConfigured()) {
    return (
      <main className="dash-main">
        <h1>Appointments — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert" className="demo-banner">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so the appointments diary is hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/appointments");

  const appointments = getAppointments();
  const customers = new Map(
    getCustomerSummaries().map((s) => [s.customer.id, s])
  );
  const nudgeCustomers = getNudgeCustomers();

  return (
    <main className="dash-main">
      <h1>Appointments — {BUSINESS_NAME}</h1>
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
        November 2026 diary, derived from the regular customers&apos; next
        due dates (see <code>lib/customers.ts</code> and{" "}
        <code>CUSTOMERS.md</code>). The salon is open Tuesday to Saturday,
        9am to 6pm.
      </p>

      <ColourLegend />

      <section className="dash-section">
        <h2>
          Upcoming appointments — November 2026{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          {appointments.length} appointments booked. Customer names link to
          their history.
        </p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>
                  Date{" "}
                  <span className="tag tag-appointments">Appointments</span>
                </th>
                <th>Time</th>
                <th>
                  Customer{" "}
                  <span className="tag tag-people">People</span>
                </th>
                <th>
                  Service{" "}
                  <span className="tag tag-services">Services</span>
                </th>
                <th>
                  Stylist{" "}
                  <span className="tag tag-people">People</span>
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => {
                const customer = customers.get(a.customerId)!;
                return (
                  <tr key={a.id}>
                    <td>{fmtDate(a.date)}</td>
                    <td>{a.time}</td>
                    <td>
                      <Link href={`/customers/${a.customerId}`}>
                        {customer.customer.name}
                      </Link>
                    </td>
                    <td>{a.service}</td>
                    <td>
                      <Link
                        href={`/employees/${employeeIdForName(a.stylist)}`}
                      >
                        {a.stylist}
                      </Link>
                    </td>
                    <td>
                      {a.status === "confirmed" ? (
                        <span className="badge badge-ok">Confirmed</span>
                      ) : (
                        <span className="badge badge-low">Requested</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dash-section">
        <h2>
          Due for a booking{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          Regulars who are due for a visit — overdue, or due within 7 days
          — with no appointment booked. They need a nudge.
        </p>
        {nudgeCustomers.length === 0 ? (
          <p>Nobody needs a nudge right now — every due customer is booked.</p>
        ) : (
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Due service</th>
                  <th>Due date</th>
                  <th>Last visit</th>
                  <th className="num">Total spent</th>
                </tr>
              </thead>
              <tbody>
                {nudgeCustomers.map((s) => (
                  <tr key={s.customer.id}>
                    <td>
                      <Link href={`/customers/${s.customer.id}`}>
                        {s.customer.name}
                      </Link>
                    </td>
                    <td>{s.nextDueService}</td>
                    <td>
                      {fmtDate(s.nextDueDate)}
                      <br />
                      <span className="sub">
                        {s.isOverdue ? "overdue" : "due within 7 days"}
                      </span>
                    </td>
                    <td>{fmtDate(s.lastVisit)}</td>
                    <td className="num">{money(s.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

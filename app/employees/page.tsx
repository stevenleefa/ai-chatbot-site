// Owner employees list for Lumen Hair Studio. Server component.
// Sample/demo data only — see lib/employees.ts and EMPLOYEES.md.
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
import { money } from "@/lib/dashboard";
import { getEmployeeSummaries } from "@/lib/employees";
import { BUSINESS_NAME } from "@/lib/leads";

export default async function EmployeesPage() {
  if (!isAuthConfigured()) {
    return (
      <main className="dash-main">
        <h1>Employees — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert" className="demo-banner">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so the employees list is hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/employees");

  const employees = getEmployeeSummaries();

  return (
    <main className="dash-main">
      <h1>Employees — {BUSINESS_NAME}</h1>
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
        {employees.length} staff. Every number is computed from the
        dashboard&apos;s sample sales rows, the customers&apos; purchases
        and the October pay run (see <code>lib/employees.ts</code> and{" "}
        <code>EMPLOYEES.md</code>).
      </p>

      <ColourLegend />

      <p>Sorted by sales revenue, highest first.</p>

      <div className="table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>
                Employee{" "}
                <span className="tag tag-people">People</span>
              </th>
              <th>Role</th>
              <th className="num">Sales</th>
              <th className="num">
                Sales revenue{" "}
                <span className="tag tag-money">Money</span>
              </th>
              <th className="num">
                Products sold{" "}
                <span className="tag tag-products">Products</span>
              </th>
              <th className="num">
                Customers{" "}
                <span className="tag tag-people">People</span>
              </th>
              <th className="num">
                Appointments{" "}
                <span className="tag tag-appointments">Appointments</span>
              </th>
              <th className="num">
                October net pay{" "}
                <span className="tag tag-money">Money</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/employees/${e.id}`}>
                    {e.employee.name}
                  </Link>
                </td>
                <td>{e.employee.role}</td>
                <td className="num">{e.salesCount}</td>
                <td className="num">{money(e.salesRevenue)}</td>
                <td className="num">
                  {e.productsCount} · {money(e.productsValue)}
                </td>
                <td className="num">{e.customers.length}</td>
                <td className="num">{e.appointments.length}</td>
                <td className="num">
                  {e.payroll ? money(e.payroll.net) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dash-note">
        Products sold are credited to the customer&apos;s preferred
        stylist; appointments are the November diary. Priya Nair is
        reception — no sales or appointments, but her pay run is below
        on her page.
      </p>
    </main>
  );
}

// Owner employee detail for Lumen Hair Studio. Server component.
// Sample/demo data only — see lib/employees.ts and EMPLOYEES.md.
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
// Unknown employee id → 404.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OwnerNav from "@/components/OwnerNav";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import { fmtDate, money } from "@/lib/dashboard";
import { getEmployeeSummary } from "@/lib/employees";
import { BUSINESS_NAME } from "@/lib/leads";

// The sales table shows the most recent sales first and caps at this
// many rows; the rest are counted, not hidden silently.
const MAX_SALES_SHOWN = 15;

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isAuthConfigured()) {
    return (
      <main className="dash-main">
        <h1>Employee — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/employees">← Back to employees</Link>
        </p>
        <p role="alert" className="demo-banner">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so employee details are hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect(`/login?next=/employees/${params.id}`);

  const summary = getEmployeeSummary(params.id);
  if (!summary) notFound();

  const e = summary.employee;
  const recentSales = [...summary.sales].reverse();
  const shownSales = recentSales.slice(0, MAX_SALES_SHOWN);
  const hiddenSales = recentSales.length - shownSales.length;

  return (
    <main className="dash-main">
      <h1>{e.name}</h1>
      <p>
        <Link href="/employees">← Back to employees</Link>
      </p>
      <OwnerNav />
      <p>
        Signed in as <strong>{session.user.email}</strong> (
        {session.profile.role}).
      </p>

      <p role="note" className="demo-banner demo-banner-sample">
        <strong>Sample demo data — not a real business&apos;s figures.</strong>{" "}
        Fictional staff member. Sales are their rows in the
        dashboard&apos;s sample sales; products are credited to the
        customer&apos;s preferred stylist; see{" "}
        <code>lib/employees.ts</code> and <code>EMPLOYEES.md</code>.
      </p>

      <p>
        {e.role} · {money(e.hourlyRate)}/hour · {e.hoursPerWeek} hours a
        week ({summary.monthlyHours.toFixed(2)} a month)
      </p>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Sales revenue</div>
          <div className="kpi-value">{money(summary.salesRevenue)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Sales</div>
          <div className="kpi-value">{summary.salesCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Products sold</div>
          <div className="kpi-value">{money(summary.productsValue)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Customers served</div>
          <div className="kpi-value">{summary.customers.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">November appointments</div>
          <div className="kpi-value">{summary.appointments.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">October net pay</div>
          <div className="kpi-value">
            {summary.payroll ? money(summary.payroll.net) : "—"}
          </div>
        </div>
      </div>

      <section className="dash-section">
        <h2>
          Sales <span className="tag tag-money">Money</span>
        </h2>
        <p>
          {summary.salesCount} sales,{" "}
          <span className="tag tag-money">
            {money(summary.salesRevenue)}
          </span>{" "}
          revenue, August to October 2026.
        </p>
        {summary.salesByService.length === 0 ? (
          <p>No sales recorded — this role does no services.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th className="num">Sales</th>
                    <th className="num">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.salesByService.map((row) => (
                    <tr key={row.service}>
                      <td>{row.service}</td>
                      <td className="num">{row.count}</td>
                      <td className="num">{money(row.revenue)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total</td>
                    <td className="num">{summary.salesCount}</td>
                    <td className="num">{money(summary.salesRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3>Recent sales</h3>
            <div className="table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Payment</th>
                    <th className="num">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {shownSales.map((s, i) => (
                    <tr key={`${s.date}-${s.service}-${i}`}>
                      <td>{fmtDate(s.date)}</td>
                      <td>{s.service}</td>
                      <td>{s.payment}</td>
                      <td className="num">{money(s.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hiddenSales > 0 && (
              <p className="dash-note">
                Showing the {MAX_SALES_SHOWN} most recent of{" "}
                {summary.salesCount} sales.
              </p>
            )}
          </>
        )}
      </section>

      <section className="dash-section">
        <h2>
          Products sold <span className="tag tag-products">Products</span>
        </h2>
        <p>
          Retail purchases credited to {e.name.split(" ")[0]} as the
          customer&apos;s preferred stylist —{" "}
          {summary.productsCount}{" "}
          {summary.productsCount === 1 ? "product" : "products"},{" "}
          <span className="tag tag-money">
            {money(summary.productsValue)}
          </span>{" "}
          in total.
        </p>
        {summary.productsSold.length === 0 ? (
          <p>No retail products credited yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th className="num">Price</th>
                </tr>
              </thead>
              <tbody>
                {summary.productsSold.map((p, i) => (
                  <tr key={`${p.date}-${p.product}-${p.customerId}-${i}`}>
                    <td>{fmtDate(p.date)}</td>
                    <td>
                      <Link href={`/customers/${p.customerId}`}>
                        {p.customerName}
                      </Link>
                    </td>
                    <td>{p.product}</td>
                    <td className="num">{money(p.price)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={3}>Total products sold</td>
                  <td className="num">{money(summary.productsValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dash-section">
        <h2>
          Customers <span className="tag tag-people">People</span>
        </h2>
        <p>
          Regulars {e.name.split(" ")[0]} looks after — anyone with a
          procedure by them, or whose preferred stylist is them.
        </p>
        {summary.customers.length === 0 ? (
          <p>No regular customers served yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Visits with {e.name.split(" ")[0]}</th>
                  <th className="num">Spent with {e.name.split(" ")[0]}</th>
                </tr>
              </thead>
              <tbody>
                {summary.customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`}>{c.name}</Link>
                    </td>
                    <td className="num">{c.visitsWithEmployee}</td>
                    <td className="num">{money(c.spentWithEmployee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dash-section">
        <h2>
          Appointments{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          {e.name.split(" ")[0]}&apos;s November 2026 diary —{" "}
          {summary.appointments.length}{" "}
          {summary.appointments.length === 1
            ? "appointment"
            : "appointments"}
          .
        </p>
        {summary.appointments.length === 0 ? (
          <p>No November appointments booked.</p>
        ) : (
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.appointments.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDate(a.date)}</td>
                    <td>{a.time}</td>
                    <td>
                      <Link href={`/customers/${a.customerId}`}>
                        {a.customerName}
                      </Link>
                    </td>
                    <td>{a.service}</td>
                    <td>
                      {a.status === "confirmed" ? (
                        <span className="badge badge-ok">Confirmed</span>
                      ) : (
                        <span className="badge badge-low">Requested</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dash-section">
        <h2>
          Payroll <span className="tag tag-money">Money</span>
        </h2>
        <p>
          October 2026 pay run —{" "}
          <span className="tag tag-money">
            {summary.payroll
              ? money(summary.payroll.net)
              : "no pay run"}
          </span>{" "}
          net pay.
        </p>
        {summary.payroll ? (
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Hours</th>
                  <th className="num">Gross</th>
                  <th className="num">Income tax (20%)</th>
                  <th className="num">Other (5%)</th>
                  <th className="num">Net pay</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {summary.payroll.name}
                    <br />
                    <span className="sub">{summary.payroll.role}</span>
                  </td>
                  <td className="num">
                    {summary.payroll.hours.toFixed(2)}
                  </td>
                  <td className="num">{money(summary.payroll.gross)}</td>
                  <td className="num">
                    {money(summary.payroll.incomeTax)}
                  </td>
                  <td className="num">
                    {money(summary.payroll.otherDeductions)}
                  </td>
                  <td className="num">{money(summary.payroll.net)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p>No pay-run row for this employee.</p>
        )}
        <p className="dash-note">
          Demo estimates — not payroll or tax advice. A real business
          files through a licensed payroll provider.
        </p>
      </section>
    </main>
  );
}

// Owner business dashboard for Lumen Hair Studio. Server component.
// Sample/demo data only — see lib/dashboard.ts and DASHBOARD.md.
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import {
  AS_OF_DATE,
  EMPLOYEES,
  EXPENSES,
  INVENTORY,
  NEXT_PAYROLL_DATE,
  OTHER_DEDUCTION_RATE,
  INCOME_TAX_RATE,
  PAYABLES,
  PL_MONTHS,
  QUARTERLY_TAX_RATE,
  RECEIVABLES,
  SALES,
  SALES_START,
  SALES_TAX_RATE,
  billStatus,
  fmtDate,
  forecastNextMonth,
  isLowStock,
  money,
  monthLabel,
  monthlyGross,
  monthlyHours,
  outstandingTotal,
  overview,
  payrollForMonth,
  profitAndLoss,
  quarterlyTaxSetAside,
  round2,
  salesByService,
  salesByWeek,
  salesTaxCollected,
  stockValue,
  sum,
  totalStockValue,
} from "@/lib/dashboard";
import { BUSINESS_NAME } from "@/lib/leads";

const NAV = [
  ["Overview", "#overview"],
  ["Sales", "#sales"],
  ["Forecast", "#forecast"],
  ["P&L", "#pl"],
  ["Employees", "#employees"],
  ["Payroll", "#payroll"],
  ["Taxes", "#taxes"],
  ["Inventory", "#inventory"],
  ["Payable", "#payable"],
  ["Receivable", "#receivable"],
] as const;

function statusBadge(status: string) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default async function DashboardPage() {
  if (!isAuthConfigured()) {
    return (
      <main className="dash-main">
        <h1>Dashboard — Lumen Hair Studio</h1>
        <p>
          <a href="/">← Back to the site</a>
        </p>
        <p role="alert" className="demo-banner">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so the dashboard is hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  const kpis = overview();
  const pl = profitAndLoss();
  const october = pl.find((r) => r.month === "2026-10")!;
  const payroll = payrollForMonth("2026-10");
  const byService = salesByService();
  const byWeek = salesByWeek();
  const forecast = forecastNextMonth();
  const taxSetAside = quarterlyTaxSetAside();
  const totalRevenue = round2(sum(SALES.map((s) => s.price)));
  const recentSales = [...SALES].slice(-50).reverse();
  const apOutstanding = outstandingTotal(PAYABLES);
  const arOutstanding = outstandingTotal(RECEIVABLES);
  const stockTotal = totalStockValue();

  return (
    <main className="dash-main">
      <h1>Dashboard — {BUSINESS_NAME}</h1>
      <p>
        <a href="/">← Back to the site</a> · <a href="/leads">Leads →</a> ·{" "}
        <a href="/admin">Admin →</a>
      </p>
      <p>
        Signed in as <strong>{session.user.email}</strong> (
        {session.profile.role}).
      </p>

      <p role="note" className="demo-banner demo-banner-sample">
        <strong>Sample demo data — not a real business&apos;s figures.</strong>{" "}
        Figures as of {fmtDate(AS_OF_DATE)}. Sales cover{" "}
        {fmtDate(SALES_START)} – {fmtDate(AS_OF_DATE)}. Every total on this
        page is computed from the sample rows in <code>lib/dashboard.ts</code>;
        see <code>DASHBOARD.md</code> to change them.
      </p>

      <nav className="dash-nav" aria-label="Dashboard sections">
        {NAV.map(([label, href]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </nav>

      <section id="overview" className="dash-section">
        <h2>Overview — {monthLabel("2026-10")}</h2>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Revenue this month</div>
            <div className="kpi-value">{money(kpis.revenueThisMonth)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Profit this month</div>
            <div className="kpi-value">{money(kpis.profitThisMonth)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Receivables outstanding</div>
            <div className="kpi-value">{money(kpis.receivablesOutstanding)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Payables outstanding</div>
            <div className="kpi-value">{money(kpis.payablesOutstanding)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Low-stock items</div>
            <div className="kpi-value">{kpis.lowStock}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Next payroll date</div>
            <div className="kpi-value">{fmtDate(kpis.nextPayrollDate)}</div>
          </div>
        </div>
      </section>

      <section id="sales" className="dash-section">
        <h2>Sales</h2>
        <p>
          {SALES.length} sales from {fmtDate(SALES_START)} to {fmtDate(AS_OF_DATE)},{" "}
          totalling <strong>{money(totalRevenue)}</strong>. Prices are the
          salon&apos;s real service prices (Haircut $35, Full colour $70,
          Balayage $110, Beard trim $15).
        </p>

        <h3>Totals by service</h3>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Service</th><th className="num">Sales</th><th className="num">Revenue</th></tr>
            </thead>
            <tbody>
              {byService.map((row) => (
                <tr key={row.service}>
                  <td>{row.service}</td>
                  <td className="num">{row.count}</td>
                  <td className="num">{money(row.revenue)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td>
                <td className="num">{SALES.length}</td>
                <td className="num">{money(totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Best seller by revenue: <strong>{byService[0].service}</strong> (
          {money(byService[0].revenue)}). Best seller by count:{" "}
          <strong>
            {[...byService].sort((a, b) => b.count - a.count)[0].service}
          </strong>{" "}
          ({[...byService].sort((a, b) => b.count - a.count)[0].count} sales).
        </p>

        <h3>Totals by week</h3>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Week of</th><th className="num">Sales</th><th className="num">Revenue</th></tr>
            </thead>
            <tbody>
              {byWeek.map((row) => (
                <tr key={row.weekStart}>
                  <td>{fmtDate(row.weekStart)}</td>
                  <td className="num">{row.count}</td>
                  <td className="num">{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Recent sales</h3>
        <p>Showing the 50 most recent of {SALES.length} sales.</p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Date</th><th>Service</th><th>Stylist</th><th>Payment</th><th className="num">Price</th></tr>
            </thead>
            <tbody>
              {recentSales.map((s, i) => (
                <tr key={`${s.date}-${i}`}>
                  <td>{fmtDate(s.date)}</td>
                  <td>{s.service}</td>
                  <td>{s.stylist}</td>
                  <td>{s.payment}</td>
                  <td className="num">{money(s.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="forecast" className="dash-section">
        <h2>Forecast — {monthLabel("2026-12")}</h2>
        <p>
          Method: average weekly revenue over the last 4 weeks (
          {fmtDate(forecast.periodStart)} – {fmtDate(forecast.periodEnd)}:{" "}
          {money(forecast.periodRevenue)} ÷ 4 = {money(forecast.weeklyAverage)}{" "}
          per week) × 4.33 weeks in a month.
        </p>
        <p className="kpi-value">Projected revenue: {money(forecast.projection)}</p>
        <p className="dash-note">Projection — an estimate, not a guarantee.</p>
      </section>

      <section id="pl" className="dash-section">
        <h2>Profit &amp; Loss</h2>
        <p>
          Revenue is the sum of that month&apos;s sales. Wages come from the
          payroll figures below.
        </p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Revenue</th>
                <th className="num">Wages</th>
                <th className="num">Other expenses</th>
                <th className="num">Total expenses</th>
                <th className="num">Profit</th>
              </tr>
            </thead>
            <tbody>
              {pl.map((row) => (
                <tr key={row.month}>
                  <td>{monthLabel(row.month)}</td>
                  <td className="num">{money(row.revenue)}</td>
                  <td className="num">{money(row.wages)}</td>
                  <td className="num">{money(row.otherExpenses)}</td>
                  <td className="num">{money(row.totalExpenses)}</td>
                  <td className={`num ${row.profit < 0 ? "negative" : ""}`}>{money(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Other expenses by month</h3>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Month</th><th>Category</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {PL_MONTHS.flatMap((month) =>
                EXPENSES.filter((e) => e.month === month).map((e) => (
                  <tr key={`${month}-${e.category}`}>
                    <td>{monthLabel(month)}</td>
                    <td>{e.category}</td>
                    <td className="num">{money(e.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="dash-note">
          October revenue {money(october.revenue)} minus October expenses{" "}
          {money(october.totalExpenses)} = profit {money(october.profit)}.
        </p>
      </section>

      <section id="employees" className="dash-section">
        <h2>Employees</h2>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Name</th><th>Role</th>
                <th className="num">Hourly rate</th>
                <th className="num">Hours / week</th>
                <th className="num">Hours / month</th>
                <th className="num">Monthly gross</th>
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES.map((e) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>{e.role}</td>
                  <td className="num">{money(e.hourlyRate)}</td>
                  <td className="num">{e.hoursPerWeek}</td>
                  <td className="num">{monthlyHours(e).toFixed(2)}</td>
                  <td className="num">{money(monthlyGross(e))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dash-note">
          Monthly hours = contracted weekly hours × 52 ÷ 12. Monthly gross =
          hourly rate × monthly hours.
        </p>
      </section>

      <section id="payroll" className="dash-section">
        <h2>Payroll — {monthLabel("2026-10")} pay run</h2>
        <p>
          Deductions are simplified flat rates: {Math.round(INCOME_TAX_RATE * 100)}%
          income tax estimate + {Math.round(OTHER_DEDUCTION_RATE * 100)}% other
          (pension + other, estimate). Net pay = gross − deductions. Next
          payroll date: {fmtDate(NEXT_PAYROLL_DATE)}.
        </p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="num">Hours</th>
                <th className="num">Gross</th>
                <th className="num">Income tax ({Math.round(INCOME_TAX_RATE * 100)}%)</th>
                <th className="num">Other ({Math.round(OTHER_DEDUCTION_RATE * 100)}%)</th>
                <th className="num">Net pay</th>
              </tr>
            </thead>
            <tbody>
              {payroll.rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}<br /><span className="sub">{r.role}</span></td>
                  <td className="num">{r.hours.toFixed(2)}</td>
                  <td className="num">{money(r.gross)}</td>
                  <td className="num">{money(r.incomeTax)}</td>
                  <td className="num">{money(r.otherDeductions)}</td>
                  <td className="num">{money(r.net)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Totals</td>
                <td className="num">{round2(sum(payroll.rows.map((r) => r.hours))).toFixed(2)}</td>
                <td className="num">{money(payroll.grossTotal)}</td>
                <td className="num">{money(payroll.taxTotal)}</td>
                <td className="num">{money(payroll.otherTotal)}</td>
                <td className="num">{money(payroll.netTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="dash-note">
          Demo estimates — not payroll or tax advice. A real business files
          through a licensed payroll provider.
        </p>
      </section>

      <section id="taxes" className="dash-section">
        <h2>Taxes</h2>
        <p>
          Sales tax collected is estimated at {Math.round(SALES_TAX_RATE * 1000) / 10}%
          of each month&apos;s sales. The quarterly set-aside is{" "}
          {Math.round(QUARTERLY_TAX_RATE * 100)}% of profit, held back for
          income tax. Both are estimates, not filings.
        </p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Month</th><th className="num">Sales</th><th className="num">Sales tax collected (est.)</th></tr>
            </thead>
            <tbody>
              {PL_MONTHS.map((month) => (
                <tr key={month}>
                  <td>{monthLabel(month)}</td>
                  <td className="num">{money(pl.find((r) => r.month === month)!.revenue)}</td>
                  <td className="num">{money(salesTaxCollected(month))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Quarterly income-tax set-aside (Q4 to date,{" "}
          {taxSetAside.months.map(monthLabel).join(" + ")}): profit{" "}
          {money(taxSetAside.profit)} × {Math.round(QUARTERLY_TAX_RATE * 100)}% ={" "}
          <strong>{money(taxSetAside.setAside)}</strong> to set aside.
        </p>
      </section>

      <section id="inventory" className="dash-section">
        <h2>Inventory</h2>
        <p>
          Stock value = quantity on hand × unit cost. An item is flagged
          low-stock when its quantity is at or below its reorder level.
        </p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">On hand</th>
                <th className="num">Reorder at</th>
                <th className="num">Unit cost</th>
                <th className="num">Stock value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {INVENTORY.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td className="num">{item.qty}</td>
                  <td className="num">{item.reorderLevel}</td>
                  <td className="num">{money(item.unitCost)}</td>
                  <td className="num">{money(stockValue(item))}</td>
                  <td>{isLowStock(item) ? <span className="badge badge-low">Low stock</span> : <span className="badge badge-ok">OK</span>}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total stock value</td>
                <td colSpan={3}></td>
                <td className="num">{money(stockTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="payable" className="dash-section">
        <h2>Accounts payable</h2>
        <p>
          Money the studio owes suppliers. Outstanding total:{" "}
          <strong>{money(apOutstanding)}</strong>.
        </p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Supplier</th><th>Description</th><th>Due</th><th className="num">Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {PAYABLES.map((b) => (
                <tr key={`${b.supplier}-${b.due}`}>
                  <td>{b.supplier}</td>
                  <td>{b.description}</td>
                  <td>{fmtDate(b.due)}</td>
                  <td className="num">{money(b.amount)}</td>
                  <td>{statusBadge(billStatus(b))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dash-note">
          &ldquo;Overdue&rdquo; means unpaid with a due date before{" "}
          {fmtDate(AS_OF_DATE)}.
        </p>
      </section>

      <section id="receivable" className="dash-section">
        <h2>Accounts receivable</h2>
        <p>
          Money clients owe the studio. Outstanding total:{" "}
          <strong>{money(arOutstanding)}</strong>.
        </p>
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Client</th><th>Description</th><th>Due</th><th className="num">Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {RECEIVABLES.map((inv) => (
                <tr key={`${inv.client}-${inv.due}`}>
                  <td>{inv.client}</td>
                  <td>{inv.description}</td>
                  <td>{fmtDate(inv.due)}</td>
                  <td className="num">{money(inv.amount)}</td>
                  <td>{statusBadge(billStatus(inv))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dash-note">
          &ldquo;Overdue&rdquo; means unpaid with a due date before{" "}
          {fmtDate(AS_OF_DATE)}.
        </p>
      </section>

      <footer className="dash-section">
        <p className="dash-note">
          Sample demo data — not a real business&apos;s figures. Change the
          seed rows in <code>lib/dashboard.ts</code> (see{" "}
          <code>DASHBOARD.md</code>) to change any number; every total on
          this page is computed from those rows. A future v2 could move this
          data into Supabase tables so the owner can edit it from the site.
        </p>
      </footer>
    </main>
  );
}

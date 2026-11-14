// Owner business dashboard for Lumen Hair Studio. Server component.
// Sample/demo data only — see lib/dashboard.ts and DASHBOARD.md.
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
// Test Admin Mode (demo mode, see DEMO_MODE.md): a signed-out visitor
// with the demo cookie sees this page as-is, because the dashboard
// already uses sample data.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth/server";
import { getDemoOrSession } from "@/lib/auth/demo";
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
import DashboardTabs from "@/components/DashboardTabs";
import DemoBanner from "@/components/DemoBanner";
import LineChart from "@/components/LineChart";
import SortableTable from "@/components/SortableTable";
import { employeeIdForName } from "@/lib/employees";

function statusBadge(status: string) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default async function DashboardPage() {
  // Test Admin Mode: a signed-out visitor with the demo cookie sees
  // this page as-is — the dashboard already uses sample data
  // (lib/dashboard.ts), so nothing else changes. The auth-configured
  // and session checks only apply outside demo mode, so demo works
  // whether or not Supabase is set up.
  const { demo, session } = await getDemoOrSession();
  if (!demo) {
    if (!isAuthConfigured()) {
      return (
        <main id="main-content" className="dash-main">
          <h1>Dashboard — Lumen Hair Studio</h1>
          <p>
            <Link href="/">← Back to the site</Link>
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

    if (!session) redirect("/login?next=/dashboard");
    // Defence in depth behind the middleware: a customer session is
    // real, but a customer must never see the owner dashboard.
    if (session.profile.role === "customer") redirect("/my-account");
  }

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
    <main id="main-content" className="dash-main">
      <h1>Dashboard — {BUSINESS_NAME}</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      {demo && <DemoBanner />}
      {demo ? (
        <p>
          <strong>Test Admin Mode</strong> — sample data, no real account.
        </p>
      ) : session ? (
        <p>
          Signed in as <strong>{session.user.email}</strong> (
          {session.profile.role}).
        </p>
      ) : null}

      <p role="note" className="demo-banner demo-banner-sample">
        <strong>Sample demo data — not a real business&apos;s figures.</strong>{" "}
        Figures as of {fmtDate(AS_OF_DATE)}. Sales cover{" "}
        {fmtDate(SALES_START)} – {fmtDate(AS_OF_DATE)}. Every total on this
        page is computed from the sample rows in <code>lib/dashboard.ts</code>;
        see <code>DASHBOARD.md</code> to change them. Every table sorts —
        click any column heading to sort by that column, click it again to
        reverse.
      </p>

      <DashboardTabs>
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
        <SortableTable
          columns={[
            { label: "Service", sortLabel: "Service" },
            { label: "Sales", sortLabel: "Sales", numeric: true },
            { label: "Revenue", sortLabel: "Revenue", numeric: true },
          ]}
          rows={byService.map((row) => ({
            key: row.service,
            cells: [row.service, row.count, money(row.revenue)],
            sort: [row.service, row.count, row.revenue],
          }))}
          totalRow={
            <tr className="total-row">
              <td>Total</td>
              <td className="num">{SALES.length}</td>
              <td className="num">{money(totalRevenue)}</td>
            </tr>
          }
        />
        <p>
          Best seller by revenue: <strong>{byService[0].service}</strong> (
          {money(byService[0].revenue)}). Best seller by count:{" "}
          <strong>
            {[...byService].sort((a, b) => b.count - a.count)[0].service}
          </strong>{" "}
          ({[...byService].sort((a, b) => b.count - a.count)[0].count} sales).
        </p>

        <h3>Totals by week</h3>
        <SortableTable
          columns={[
            { label: "Week of", sortLabel: "Week of" },
            { label: "Sales", sortLabel: "Sales", numeric: true },
            { label: "Revenue", sortLabel: "Revenue", numeric: true },
          ]}
          rows={byWeek.map((row) => ({
            key: row.weekStart,
            cells: [fmtDate(row.weekStart), row.count, money(row.revenue)],
            sort: [row.weekStart, row.count, row.revenue],
          }))}
        />

        <LineChart
          title="Weekly revenue"
          yLabel="Revenue ($)"
          labels={byWeek.map((row) => fmtDate(row.weekStart).replace(/, \d{4}$/, ""))}
          series={[{ label: "Revenue", color: "#a05a66", values: byWeek.map((row) => row.revenue) }]}
        />

        <h3>Recent sales</h3>
        <p>Showing the 50 most recent of {SALES.length} sales.</p>
        <SortableTable
          columns={[
            { label: "Date", sortLabel: "Date" },
            { label: "Service", sortLabel: "Service" },
            { label: "Stylist", sortLabel: "Stylist" },
            { label: "Payment", sortLabel: "Payment" },
            { label: "Price", sortLabel: "Price", numeric: true },
          ]}
          rows={recentSales.map((s, i) => ({
            key: `${s.date}-${i}`,
            cells: [
              fmtDate(s.date),
              s.service,
              <Link href={`/employees/${employeeIdForName(s.stylist)}`}>
                {s.stylist}
              </Link>,
              s.payment,
              money(s.price),
            ],
            sort: [s.date, s.service, s.stylist, s.payment, s.price],
          }))}
        />
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
        <SortableTable
          columns={[
            { label: "Month", sortLabel: "Month" },
            { label: "Revenue", sortLabel: "Revenue", numeric: true },
            { label: "Wages", sortLabel: "Wages", numeric: true },
            {
              label: "Other expenses",
              sortLabel: "Other expenses",
              numeric: true,
            },
            {
              label: "Total expenses",
              sortLabel: "Total expenses",
              numeric: true,
            },
            { label: "Profit", sortLabel: "Profit", numeric: true },
          ]}
          rows={pl.map((row) => ({
            key: row.month,
            cells: [
              monthLabel(row.month),
              money(row.revenue),
              money(row.wages),
              money(row.otherExpenses),
              money(row.totalExpenses),
              // The "negative" class lives on a span, not the cell:
              // SortableTable only sets the column class on cells.
              <span className={row.profit < 0 ? "negative" : undefined}>
                {money(row.profit)}
              </span>,
            ],
            sort: [
              row.month,
              row.revenue,
              row.wages,
              row.otherExpenses,
              row.totalExpenses,
              row.profit,
            ],
          }))}
        />

        <LineChart
          title="Monthly revenue and profit"
          yLabel="Amount ($)"
          labels={pl.map((row) => monthLabel(row.month))}
          series={[
            { label: "Revenue", color: "#a05a66", values: pl.map((row) => row.revenue) },
            { label: "Profit", color: "#8a6d1f", values: pl.map((row) => row.profit) },
          ]}
        />

        <h3>Other expenses by month</h3>
        <SortableTable
          columns={[
            { label: "Month", sortLabel: "Month" },
            { label: "Category", sortLabel: "Category" },
            { label: "Amount", sortLabel: "Amount", numeric: true },
          ]}
          rows={PL_MONTHS.flatMap((month) =>
            EXPENSES.filter((e) => e.month === month).map((e) => ({
              key: `${month}-${e.category}`,
              cells: [monthLabel(month), e.category, money(e.amount)],
              sort: [month, e.category, e.amount],
            }))
          )}
        />
        <p className="dash-note">
          October revenue {money(october.revenue)} minus October expenses{" "}
          {money(october.totalExpenses)} = profit {money(october.profit)}.
        </p>
      </section>

      <section id="employees" className="dash-section">
        <h2>Employees</h2>
        <SortableTable
          columns={[
            { label: "Name", sortLabel: "Name" },
            { label: "Role", sortLabel: "Role" },
            { label: "Hourly rate", sortLabel: "Hourly rate", numeric: true },
            {
              label: "Hours / week",
              sortLabel: "Hours / week",
              numeric: true,
            },
            {
              label: "Hours / month",
              sortLabel: "Hours / month",
              numeric: true,
            },
            {
              label: "Monthly gross",
              sortLabel: "Monthly gross",
              numeric: true,
            },
          ]}
          rows={EMPLOYEES.map((e) => ({
            key: e.name,
            cells: [
              <Link href={`/employees/${employeeIdForName(e.name)}`}>
                {e.name}
              </Link>,
              e.role,
              money(e.hourlyRate),
              e.hoursPerWeek,
              monthlyHours(e).toFixed(2),
              money(monthlyGross(e)),
            ],
            sort: [
              e.name,
              e.role,
              e.hourlyRate,
              e.hoursPerWeek,
              monthlyHours(e),
              monthlyGross(e),
            ],
          }))}
        />
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
        <SortableTable
          columns={[
            { label: "Employee", sortLabel: "Employee" },
            { label: "Hours", sortLabel: "Hours", numeric: true },
            { label: "Gross", sortLabel: "Gross", numeric: true },
            {
              label: `Income tax (${Math.round(INCOME_TAX_RATE * 100)}%)`,
              sortLabel: "Income tax",
              numeric: true,
            },
            {
              label: `Other (${Math.round(OTHER_DEDUCTION_RATE * 100)}%)`,
              sortLabel: "Other deductions",
              numeric: true,
            },
            { label: "Net pay", sortLabel: "Net pay", numeric: true },
          ]}
          rows={payroll.rows.map((r) => ({
            key: r.name,
            cells: [
              <>
                <Link href={`/employees/${employeeIdForName(r.name)}`}>
                  {r.name}
                </Link>
                <br />
                <span className="sub">{r.role}</span>
              </>,
              r.hours.toFixed(2),
              money(r.gross),
              money(r.incomeTax),
              money(r.otherDeductions),
              money(r.net),
            ],
            sort: [
              r.name,
              r.hours,
              r.gross,
              r.incomeTax,
              r.otherDeductions,
              r.net,
            ],
          }))}
          totalRow={
            <tr className="total-row">
              <td>Totals</td>
              <td className="num">{round2(sum(payroll.rows.map((r) => r.hours))).toFixed(2)}</td>
              <td className="num">{money(payroll.grossTotal)}</td>
              <td className="num">{money(payroll.taxTotal)}</td>
              <td className="num">{money(payroll.otherTotal)}</td>
              <td className="num">{money(payroll.netTotal)}</td>
            </tr>
          }
        />
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
        <SortableTable
          columns={[
            { label: "Month", sortLabel: "Month" },
            { label: "Sales", sortLabel: "Sales", numeric: true },
            {
              label: "Sales tax collected (est.)",
              sortLabel: "Sales tax collected",
              numeric: true,
            },
          ]}
          rows={PL_MONTHS.map((month) => ({
            key: month,
            cells: [
              monthLabel(month),
              money(pl.find((r) => r.month === month)!.revenue),
              money(salesTaxCollected(month)),
            ],
            sort: [
              month,
              pl.find((r) => r.month === month)!.revenue,
              salesTaxCollected(month),
            ],
          }))}
        />
        <LineChart
          title="Sales tax collected by month"
          yLabel="Sales tax ($)"
          labels={PL_MONTHS.map((month) => monthLabel(month))}
          series={[{ label: "Sales tax", color: "#a05a66", values: PL_MONTHS.map((month) => salesTaxCollected(month)) }]}
        />
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
        <SortableTable
          columns={[
            { label: "Product", sortLabel: "Product" },
            { label: "On hand", sortLabel: "On hand", numeric: true },
            { label: "Reorder at", sortLabel: "Reorder at", numeric: true },
            { label: "Unit cost", sortLabel: "Unit cost", numeric: true },
            { label: "Stock value", sortLabel: "Stock value", numeric: true },
            { label: "Status", sortLabel: "Status" },
          ]}
          rows={INVENTORY.map((item) => ({
            key: item.name,
            cells: [
              item.name,
              item.qty,
              item.reorderLevel,
              money(item.unitCost),
              money(stockValue(item)),
              isLowStock(item) ? (
                <span className="badge badge-low">Low stock</span>
              ) : (
                <span className="badge badge-ok">OK</span>
              ),
            ],
            sort: [
              item.name,
              item.qty,
              item.reorderLevel,
              item.unitCost,
              stockValue(item),
              isLowStock(item) ? "Low stock" : "OK",
            ],
          }))}
          totalRow={
            <tr className="total-row">
              <td>Total stock value</td>
              <td colSpan={3}></td>
              <td className="num">{money(stockTotal)}</td>
              <td></td>
            </tr>
          }
        />
      </section>

      <section id="payable" className="dash-section">
        <h2>Accounts payable</h2>
        <p>
          Money the studio owes suppliers. Outstanding total:{" "}
          <strong>{money(apOutstanding)}</strong>.
        </p>
        <SortableTable
          columns={[
            { label: "Supplier", sortLabel: "Supplier" },
            { label: "Description", sortLabel: "Description" },
            { label: "Due", sortLabel: "Due" },
            { label: "Amount", sortLabel: "Amount", numeric: true },
            { label: "Status", sortLabel: "Status" },
          ]}
          rows={PAYABLES.map((b) => ({
            key: `${b.supplier}-${b.due}`,
            cells: [
              b.supplier,
              b.description,
              fmtDate(b.due),
              money(b.amount),
              statusBadge(billStatus(b)),
            ],
            sort: [b.supplier, b.description, b.due, b.amount, billStatus(b)],
          }))}
        />
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
        <SortableTable
          columns={[
            { label: "Client", sortLabel: "Client" },
            { label: "Description", sortLabel: "Description" },
            { label: "Due", sortLabel: "Due" },
            { label: "Amount", sortLabel: "Amount", numeric: true },
            { label: "Status", sortLabel: "Status" },
          ]}
          rows={RECEIVABLES.map((inv) => ({
            key: `${inv.client}-${inv.due}`,
            cells: [
              inv.client,
              inv.description,
              fmtDate(inv.due),
              money(inv.amount),
              statusBadge(billStatus(inv)),
            ],
            sort: [
              inv.client,
              inv.description,
              inv.due,
              inv.amount,
              billStatus(inv),
            ],
          }))}
        />
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
      </DashboardTabs>
    </main>
  );
}

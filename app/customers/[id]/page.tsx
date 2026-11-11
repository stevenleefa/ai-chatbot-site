// Owner customer detail for Lumen Hair Studio. Server component.
// Sample/demo data only — see lib/customers.ts and CUSTOMERS.md.
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
// Unknown customer id → 404.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SortableTable from "@/components/SortableTable";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import { fmtDate, money } from "@/lib/dashboard";
import { formatTime, getCustomerSummary } from "@/lib/customers";
import { employeeIdForName } from "@/lib/employees";
import { BUSINESS_NAME } from "@/lib/leads";

// The procedures table shows the most recent visits first and caps at
// this many rows; the rest are counted, not hidden silently.
const MAX_PROCEDURES_SHOWN = 15;

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isAuthConfigured()) {
    return (
      <main id="main-content" className="dash-main">
        <h1>Customer — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/customers">← Back to customers</Link>
        </p>
        <p role="alert" className="demo-banner">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so customer details are hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect(`/login?next=/customers/${params.id}`);

  const summary = getCustomerSummary(params.id);
  if (!summary) notFound();

  const procedures = [...summary.procedures].reverse();
  const shownProcedures = procedures.slice(0, MAX_PROCEDURES_SHOWN);
  const hiddenProcedures = procedures.length - shownProcedures.length;

  return (
    <main id="main-content" className="dash-main">
      <h1>{summary.customer.name}</h1>
      <p>
        <Link href="/customers">← Back to customers</Link>
      </p>
      <p>
        Signed in as <strong>{session.user.email}</strong> (
        {session.profile.role}).
      </p>

      <p role="note" className="demo-banner demo-banner-sample">
        <strong>Sample demo data — not a real business&apos;s figures.</strong>{" "}
        Fictional regular customer. Visits are a subset of the
        dashboard&apos;s sample sales rows; see <code>lib/customers.ts</code>{" "}
        and <code>CUSTOMERS.md</code>.
      </p>

      <p>
        {summary.customer.phone} · {summary.customer.email}
        <br />
        Customer since {fmtDate(summary.firstVisit)} · Preferred stylist{" "}
        <Link
          href={`/employees/${employeeIdForName(summary.preferredStylist)}`}
        >
          {summary.preferredStylist}
        </Link>
      </p>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Visits</div>
          <div className="kpi-value">{summary.visits}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total spent</div>
          <div className="kpi-value">{money(summary.totalSpent)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Last visit</div>
          <div className="kpi-value">{fmtDate(summary.lastVisit)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Next due</div>
          <div className="kpi-value">{fmtDate(summary.nextDueDate)}</div>
        </div>
      </div>

      <section className="dash-section">
        <h2>
          Procedures <span className="tag tag-services">Services</span>
        </h2>
        <p>
          Past services, most recent first ({summary.visits} visits,{" "}
          {money(summary.servicesTotal)} on services). Click any column
          heading to sort by that column; click it again to reverse.
        </p>
        <SortableTable
          columns={[
            { label: "Date", sortLabel: "Date" },
            { label: "Service", sortLabel: "Service" },
            { label: "Stylist", sortLabel: "Stylist" },
            { label: "Price", sortLabel: "Price", numeric: true },
          ]}
          rows={shownProcedures.map((p, i) => ({
            key: `${p.date}-${p.service}-${i}`,
            cells: [
              fmtDate(p.date),
              p.service,
              <Link href={`/employees/${employeeIdForName(p.stylist)}`}>
                {p.stylist}
              </Link>,
              money(p.price),
            ],
            sort: [p.date, p.service, p.stylist, p.price],
          }))}
        />
        {hiddenProcedures > 0 && (
          <p className="dash-note">
            Showing the {MAX_PROCEDURES_SHOWN} most recent of{" "}
            {summary.visits} procedures.
          </p>
        )}
      </section>

      <section className="dash-section">
        <h2>
          Purchases <span className="tag tag-products">Products</span>
        </h2>
        <p>
          Retail products bought in the salon (
          {money(summary.purchasesTotal)} on products). Click any column
          heading to sort by that column.
        </p>
        {summary.purchases.length === 0 ? (
          <p>No retail purchases recorded yet.</p>
        ) : (
          <SortableTable
            columns={[
              { label: "Date", sortLabel: "Date" },
              { label: "Product", sortLabel: "Product" },
              { label: "Price", sortLabel: "Price", numeric: true },
            ]}
            rows={summary.purchases.map((p, i) => ({
              key: `${p.date}-${p.product}-${i}`,
              cells: [fmtDate(p.date), p.product, money(p.price)],
              sort: [p.date, p.product, p.price],
            }))}
            totalRow={
              <tr className="total-row">
                <td colSpan={2}>Total on products</td>
                <td className="num">
                  <span className="tag tag-money">
                    {money(summary.purchasesTotal)}
                  </span>
                </td>
              </tr>
            }
          />
        )}
      </section>

      <section className="dash-section">
        <h2>
          Might be interested in{" "}
          <span className="tag tag-products">Products</span>
        </h2>
        <p>
          Suggestions from their history — products they haven&apos;t
          bought yet, with the reason.
        </p>
        <div className="rec-grid">
          {summary.recommendations.map((r) => (
            <article key={r.product} className="rec-card">
              <h3>{r.product}</h3>
              <p className="price">{money(r.price)}</p>
              <p>{r.reason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dash-section">
        <h2>
          Due for a visit{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          Next due: <strong>{summary.nextDueService}</strong> on{" "}
          <strong>{fmtDate(summary.nextDueDate)}</strong> —{" "}
          {summary.isOverdue
            ? "overdue"
            : summary.isDueSoon
              ? "due within 7 days"
              : "not due yet"}
          .
        </p>
        <p className="dash-note">
          Due dates by service (their usual cycle — last visit + the
          service&apos;s usual interval):{" "}
          {summary.dues
            .map((d) => `${d.service} ${fmtDate(d.dueDate)}`)
            .join(" · ")}
          .
        </p>
        {summary.needsNudge ? (
          <div className="nudge-box">
            <p>
              <strong>Suggested nudge:</strong>
            </p>
            <p>{summary.nudgeMessage}</p>
          </div>
        ) : summary.appointment ? (
          <p>
            Booked for{" "}
            {summary.appointments.map((a, i) => (
              <span key={a.id}>
                {i > 0 ? " and " : ""}
                <strong>
                  {fmtDate(a.date)} at {formatTime(a.time)}
                </strong>{" "}
                ({a.service} with{" "}
                <Link
                  href={`/employees/${employeeIdForName(a.stylist)}`}
                >
                  {a.stylist}
                </Link>
                , {a.status})
              </span>
            ))}
            . See <Link href="/appointments">Appointments</Link>.
          </p>
        ) : (
          <p>Not due yet — no nudge needed.</p>
        )}
      </section>
    </main>
  );
}

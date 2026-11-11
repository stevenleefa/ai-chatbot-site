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
import SortableTable, {
  type SortableColumn,
  type SortableRow,
} from "@/components/SortableTable";
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

  // Column headers: the label (with its colour chip) is what you
  // see; the sort value is what clicking sorts by — ISO dates for
  // date columns, numbers for money and counts. Default order is
  // next due soonest, until a header is clicked.
  const columns: SortableColumn[] = [
    {
      label: (
        <>
          Customer <span className="tag tag-people">People</span>
        </>
      ),
      sortLabel: "Customer",
    },
    { label: "Contact", sortLabel: "Contact" },
    { label: "Last visit", sortLabel: "Last visit" },
    {
      label: (
        <>
          Next due{" "}
          <span className="tag tag-appointments">Appointments</span>
        </>
      ),
      sortLabel: "Next due",
    },
    { label: "Status", sortLabel: "Status" },
    { label: "Visits", sortLabel: "Visits", numeric: true },
    {
      label: (
        <>
          Total spent <span className="tag tag-money">Money</span>
        </>
      ),
      sortLabel: "Total spent",
      numeric: true,
    },
  ];
  const rows: SortableRow[] = customers.map((c) => ({
    key: c.customer.id,
    cells: [
      <Link href={`/customers/${c.customer.id}`}>
        {c.customer.name}
      </Link>,
      <>
        {c.customer.phone}
        <br />
        <span className="sub">{c.customer.email}</span>
      </>,
      fmtDate(c.lastVisit),
      <>
        {fmtDate(c.nextDueDate)}
        <br />
        <span className="sub">{c.nextDueService}</span>
      </>,
      c.needsNudge ? (
        <span className="badge badge-low">Needs a nudge</span>
      ) : (
        <span className="badge badge-ok">Booked</span>
      ),
      c.visits,
      money(c.totalSpent),
    ],
    sort: [
      c.customer.name,
      c.customer.phone,
      c.lastVisit,
      c.nextDueDate,
      c.needsNudge ? "Needs a nudge" : "Booked",
      c.visits,
      c.totalSpent,
    ],
  }));

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
        due date, soonest first. Click any column heading to sort by that
        column; click it again to reverse.
      </p>

      <SortableTable columns={columns} rows={rows} />
    </main>
  );
}

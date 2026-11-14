// Owner employees list for Lumen Hair Studio. Server component.
// Sample/demo data only — see lib/employees.ts and EMPLOYEES.md.
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import ColourLegend from "@/components/ColourLegend";
import DemoBanner from "@/components/DemoBanner";
import SortableTable, {
  type SortableColumn,
  type SortableRow,
} from "@/components/SortableTable";
import { isAuthConfigured } from "@/lib/auth/server";
import { getDemoOrSession } from "@/lib/auth/demo";
import { money } from "@/lib/dashboard";
import { getEmployeeSummaries } from "@/lib/employees";
import { BUSINESS_NAME } from "@/lib/leads";

export default async function EmployeesPage() {
  // Test Admin Mode: a signed-out visitor with the demo cookie sees
  // this page as-is — the employees list is already derived from
  // sample data (lib/dashboard.ts, lib/employees.ts), so nothing else
  // changes. The auth-configured and session checks only apply
  // outside demo mode, so demo works whether or not Supabase is set up.
  const { demo, session } = await getDemoOrSession();
  if (!demo && !isAuthConfigured()) {
    return (
      <main id="main-content" className="dash-main">
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

  if (!demo) {
    if (!session) redirect("/login?next=/employees");
    // Defence in depth behind the middleware: a customer session is
    // real, but a customer must never see the owner employee list.
    if (session.profile.role === "customer") redirect("/my-account");
  }

  const employees = getEmployeeSummaries();

  // Default order is sales revenue, highest first, until a header
  // is clicked. "Products sold" sorts by the count (the cell shows
  // count · value); money and counts sort numerically.
  const columns: SortableColumn[] = [
    {
      label: (
        <>
          Employee <span className="tag tag-people">People</span>
        </>
      ),
      sortLabel: "Employee",
    },
    { label: "Role", sortLabel: "Role" },
    { label: "Sales", sortLabel: "Sales", numeric: true },
    {
      label: (
        <>
          Sales revenue <span className="tag tag-money">Money</span>
        </>
      ),
      sortLabel: "Sales revenue",
      numeric: true,
    },
    {
      label: (
        <>
          Products sold{" "}
          <span className="tag tag-products">Products</span>
        </>
      ),
      sortLabel: "Products sold",
      numeric: true,
    },
    {
      label: (
        <>
          Customers <span className="tag tag-people">People</span>
        </>
      ),
      sortLabel: "Customers",
      numeric: true,
    },
    {
      label: (
        <>
          Appointments{" "}
          <span className="tag tag-appointments">Appointments</span>
        </>
      ),
      sortLabel: "Appointments",
      numeric: true,
    },
    {
      label: (
        <>
          October net pay <span className="tag tag-money">Money</span>
        </>
      ),
      sortLabel: "October net pay",
      numeric: true,
    },
  ];
  const rows: SortableRow[] = employees.map((e) => ({
    key: e.id,
    cells: [
      <Link href={`/employees/${e.id}`}>{e.employee.name}</Link>,
      e.employee.role,
      e.salesCount,
      money(e.salesRevenue),
      <>
        {e.productsCount} · {money(e.productsValue)}
      </>,
      e.customers.length,
      e.appointments.length,
      e.payroll ? money(e.payroll.net) : "—",
    ],
    sort: [
      e.employee.name,
      e.employee.role,
      e.salesCount,
      e.salesRevenue,
      e.productsCount,
      e.customers.length,
      e.appointments.length,
      e.payroll ? e.payroll.net : 0,
    ],
  }));

  return (
    <main id="main-content" className="dash-main">
      <h1>Employees — {BUSINESS_NAME}</h1>
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
        {employees.length} staff. Every number is computed from the
        dashboard&apos;s sample sales rows, the customers&apos; purchases
        and the October pay run (see <code>lib/employees.ts</code> and{" "}
        <code>EMPLOYEES.md</code>).
      </p>

      <ColourLegend />

      <p>
        Sorted by sales revenue, highest first. Click any column
        heading to sort by that column; click it again to reverse.
      </p>

      <SortableTable columns={columns} rows={rows} />
      <p className="dash-note">
        Products sold are credited to the customer&apos;s preferred
        stylist; appointments are the November diary. Priya Nair is
        reception — no sales or appointments, but her pay run is below
        on her page.
      </p>
    </main>
  );
}

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
import AppointmentCalendar from "@/components/AppointmentCalendar";
import SortableTable, {
  type SortableColumn,
  type SortableRow,
} from "@/components/SortableTable";
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

  // Diary table: default order is date, earliest first. The
  // calendar above it shows the same 8 appointments on a month grid.
  const diaryColumns: SortableColumn[] = [
    {
      label: (
        <>
          Date <span className="tag tag-appointments">Appointments</span>
        </>
      ),
      sortLabel: "Date",
    },
    { label: "Time", sortLabel: "Time" },
    {
      label: (
        <>
          Customer <span className="tag tag-people">People</span>
        </>
      ),
      sortLabel: "Customer",
    },
    {
      label: (
        <>
          Service <span className="tag tag-services">Services</span>
        </>
      ),
      sortLabel: "Service",
    },
    {
      label: (
        <>
          Stylist <span className="tag tag-people">People</span>
        </>
      ),
      sortLabel: "Stylist",
    },
    { label: "Status", sortLabel: "Status" },
  ];
  const diaryRows: SortableRow[] = appointments.map((a) => {
    const customer = customers.get(a.customerId)!;
    return {
      key: a.id,
      cells: [
        fmtDate(a.date),
        a.time,
        <Link href={`/customers/${a.customerId}`}>
          {customer.customer.name}
        </Link>,
        a.service,
        <Link href={`/employees/${employeeIdForName(a.stylist)}`}>
          {a.stylist}
        </Link>,
        a.status === "confirmed" ? (
          <span className="badge badge-ok">Confirmed</span>
        ) : (
          <span className="badge badge-low">Requested</span>
        ),
      ],
      sort: [
        a.date,
        a.time,
        customer.customer.name,
        a.service,
        a.stylist,
        a.status === "confirmed" ? "Confirmed" : "Requested",
      ],
    };
  });

  // Due-for-a-booking table: default order is due date, soonest first.
  const nudgeColumns: SortableColumn[] = [
    { label: "Customer", sortLabel: "Customer" },
    { label: "Due service", sortLabel: "Due service" },
    { label: "Due date", sortLabel: "Due date" },
    { label: "Last visit", sortLabel: "Last visit" },
    { label: "Total spent", sortLabel: "Total spent", numeric: true },
  ];
  const nudgeRows: SortableRow[] = nudgeCustomers.map((s) => ({
    key: s.customer.id,
    cells: [
      <Link href={`/customers/${s.customer.id}`}>
        {s.customer.name}
      </Link>,
      s.nextDueService,
      <>
        {fmtDate(s.nextDueDate)}
        <br />
        <span className="sub">
          {s.isOverdue ? "overdue" : "due within 7 days"}
        </span>
      </>,
      fmtDate(s.lastVisit),
      money(s.totalSpent),
    ],
    sort: [
      s.customer.name,
      s.nextDueService,
      s.nextDueDate,
      s.lastVisit,
      s.totalSpent,
    ],
  }));

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
          November 2026 calendar{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          Every booked appointment on the month grid — click a name to
          open that customer or stylist. Sundays and Mondays are closed.
          The diary covers November 2026 only, so there is no month
          navigation.
        </p>
        <AppointmentCalendar
          appointments={appointments.map((a) => ({
            ...a,
            customerName: customers.get(a.customerId)!.customer.name,
          }))}
        />
      </section>

      <section className="dash-section">
        <h2>
          Upcoming appointments — November 2026{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          {appointments.length} appointments booked. Customer names link to
          their history. Click any column heading to sort by that column;
          click it again to reverse.
        </p>
        <SortableTable columns={diaryColumns} rows={diaryRows} />
      </section>

      <section className="dash-section">
        <h2>
          Due for a booking{" "}
          <span className="tag tag-appointments">Appointments</span>
        </h2>
        <p>
          Regulars who are due for a visit — overdue, or due within 7 days
          — with no appointment booked. They need a nudge. Click any
          column heading to sort by that column.
        </p>
        {nudgeCustomers.length === 0 ? (
          <p>Nobody needs a nudge right now — every due customer is booked.</p>
        ) : (
          <SortableTable columns={nudgeColumns} rows={nudgeRows} />
        )}
      </section>
    </main>
  );
}

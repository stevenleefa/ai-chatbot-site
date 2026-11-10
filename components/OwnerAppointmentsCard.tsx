import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getAppointments, getNudgeCustomers } from "@/lib/customers";

// Small "Appointments" card for the homepage, for signed-in owners
// only — a real site never shows customer-data links to visitors, so
// it renders nothing when signed out. A Server Component: it reads the
// session on the server (like OwnerNav). Passed into HomeClient as a
// prop from app/page.tsx, so it can sit just under the hero instead of
// at the very bottom of the page.
export default async function OwnerAppointmentsCard() {
  const session = await getSession();
  if (!session) return null;
  const appointments = getAppointments();
  const nudges = getNudgeCustomers();
  return (
    <div className="owner-card">
      <h2>Appointments</h2>
      <p>
        {appointments.length} appointments booked in November ·{" "}
        {nudges.length} {nudges.length === 1 ? "customer" : "customers"}{" "}
        due a nudge.
      </p>
      <Link href="/appointments">View appointments →</Link>
    </div>
  );
}

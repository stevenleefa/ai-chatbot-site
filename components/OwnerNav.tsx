import Link from "next/link";
import { getSession } from "@/lib/auth/session";

// Owner navigation buttons. A Server Component: it reads the session on
// the server, so it shows the right buttons without a client fetch.
// Used in the site nav (via AuthNav) and at the top of /leads,
// /dashboard and /admin, so the owner never has to type a route:
// Dashboard and Leads for every signed-in staff member, Admin only
// for admins, plus Sign out. Signed out, it is just the sign-in link.
// The links use next/link (client-side navigation) instead of plain
// <a>: the owner pages are server-rendered and slow to arrive on a
// full reload, and a plain link gives no feedback while loading —
// which reads as a dead first click.
export default async function OwnerNav() {
  const session = await getSession();
  if (!session) {
    return <Link href="/login">Owner sign in</Link>;
  }
  return (
    <div className="owner-nav">
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/leads">Leads</Link>
      {session.profile.role === "admin" && <Link href="/admin">Admin</Link>}
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}

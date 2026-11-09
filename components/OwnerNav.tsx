import { getSession } from "@/lib/auth/session";

// Owner navigation buttons. A Server Component: it reads the session on
// the server, so it shows the right buttons without a client fetch.
// Used in the site nav (via AuthNav) and at the top of /leads,
// /dashboard and /admin, so the owner never has to type a route:
// Dashboard and Leads for every signed-in staff member, Admin only
// for admins, plus Sign out. Signed out, it is just the sign-in link.
export default async function OwnerNav() {
  const session = await getSession();
  if (!session) {
    return <a href="/login">Owner sign in</a>;
  }
  return (
    <div className="owner-nav">
      <a href="/dashboard">Dashboard</a>
      <a href="/leads">Leads</a>
      {session.profile.role === "admin" && <a href="/admin">Admin</a>}
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}

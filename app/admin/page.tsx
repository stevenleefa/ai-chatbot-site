// Admin area for Lumen Hair Studio. ADMIN role only: staff see an
// "Admins only" page instead of the user list. Unauthenticated users are
// redirected to /login by the middleware, and this page checks the
// session itself too (defense in depth).
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession, type Profile } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/site-settings";
import { getPendingReviews } from "@/lib/reviews-server";
import { setUserActive, setUserRole, saveSiteSettings, approveReview, deleteReview } from "./actions";
import InviteStaffForm from "@/components/InviteStaffForm";

export default async function AdminPage() {
  if (!isAuthConfigured()) {
    return (
      <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
        <h1>Admin — Lumen Hair Studio</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert" className="alert-note">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  if (session.profile.role !== "admin") {
    return (
      <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
        <h1>Admin — Lumen Hair Studio</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert">
          <strong>Admins only.</strong> You are signed in, but your account
          does not have the admin role. Ask an admin to promote you on this
          page.
        </p>
        <p>
          Signed in as {session.user.email} ({session.profile.role}).
        </p>
      </main>
    );
  }

  let profiles: Profile[] = [];
  let storageError = "";
  if (!isSupabaseConfigured()) {
    storageError =
      "Leads storage is not configured (SUPABASE_SERVICE_ROLE_KEY missing), so the user list cannot be loaded.";
  } else {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("profiles")
      .select("id, email, role, is_active, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      storageError = `Could not load users: ${error.message}`;
    } else {
      profiles = (data ?? []) as Profile[];
    }
  }

  const settings = await getSiteSettings();
  const pendingReviews = await getPendingReviews();

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <h1>Admin — Lumen Hair Studio</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      <p>
        Signed in as <strong>{session.user.email}</strong> (admin).
      </p>

      <section>
        <h2>Users</h2>
        <p>
          Staff join by admin invite only — there is no public signup.
          Invite someone below and they start as staff; promote them
          here when they need admin access. Deactivated accounts cannot
          sign in. The last remaining active admin cannot be demoted or
          deactivated.
        </p>
        {storageError && (
          <p role="alert" className="alert-note">
            {storageError}
          </p>
        )}
        {profiles.length === 0 && !storageError ? (
          <p>No users yet.</p>
        ) : (
          <div
            style={{ overflowX: "auto" }}
            tabIndex={0}
            role="region"
            aria-label="Users table"
          >
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Active</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td>{p.email}</td>
                    <td>{p.role}</td>
                    <td>{p.is_active ? "Yes" : "No"}</td>
                    <td>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <form action={setUserRole} style={{ display: "inline", marginRight: 8 }}>
                        <input type="hidden" name="userId" value={p.id} />
                        <input
                          type="hidden"
                          name="role"
                          value={p.role === "admin" ? "staff" : "admin"}
                        />
                        <button type="submit">
                          {p.role === "admin" ? "Demote to staff" : "Make admin"}
                        </button>
                      </form>
                      <form action={setUserActive} style={{ display: "inline" }}>
                        <input type="hidden" name="userId" value={p.id} />
                        <input type="hidden" name="active" value={p.is_active ? "false" : "true"} />
                        <button type="submit">
                          {p.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Invite staff</h2>
        <p>
          Send an invite email. The person clicks the link in the email,
          is signed in through /auth/callback, and sets their first
          password on /auth/update-password. They start as staff.
        </p>
        <InviteStaffForm />
      </section>

      <section>
        <h2>
          Review approvals
          {pendingReviews.length > 0 ? ` (${pendingReviews.length} pending)` : ""}
        </h2>
        <p>
          Visitor reviews arrive as pending and only appear on the
          homepage once approved here. Approve the genuine ones;
          delete spam or anything the studio would not want shown.
          The seed reviews on the homepage are demo data in code, not
          rows here — they are not listed.
        </p>
        {!isSupabaseConfigured() ? (
          <p role="alert" className="alert-note">
            Review storage is not configured
            (SUPABASE_SERVICE_ROLE_KEY missing), so reviews cannot be
            listed or approved yet. See REVIEWS.md.
          </p>
        ) : pendingReviews.length === 0 ? (
          <p>No reviews waiting for approval.</p>
        ) : (
          <div
            style={{ overflowX: "auto" }}
            tabIndex={0}
            role="region"
            aria-label="Pending reviews table"
          >
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Rating</th>
                  <th>Service</th>
                  <th>Review</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingReviews.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <span role="img" aria-label={`${r.rating} out of 5 stars`}>
                        {"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}
                      </span>
                    </td>
                    <td>{r.service ?? "—"}</td>
                    <td>{r.text}</td>
                    <td>
                      <form action={approveReview} style={{ display: "inline", marginRight: 8 }}>
                        <input type="hidden" name="reviewId" value={r.id} />
                        <button type="submit">Approve</button>
                      </form>
                      <form action={deleteReview} style={{ display: "inline" }}>
                        <input type="hidden" name="reviewId" value={r.id} />
                        <button type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Site settings</h2>
        <p>
          These details show in the homepage header. Saving here updates
          the live site immediately. Services and prices still live in{" "}
          <code>lib/business.ts</code> — edit those in code for now (see
          AUTH.md).
        </p>
        <form action={saveSiteSettings} className="lead-form">
          <label>
            Business name
            <input name="business_name" required defaultValue={settings.business_name} />
          </label>
          <label>
            Phone
            <input name="phone" required defaultValue={settings.phone} />
          </label>
          <label>
            Email
            <input name="email" type="email" defaultValue={settings.email} />
          </label>
          <label>
            Address
            <input name="address" defaultValue={settings.address} />
          </label>
          <label>
            Hours
            <input name="hours" defaultValue={settings.hours} />
          </label>
          <button type="submit">Save settings</button>
        </form>
      </section>
    </main>
  );
}

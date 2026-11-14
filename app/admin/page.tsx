// Admin area for Lumen Hair Studio. ADMIN role only: staff see an
// "Admins only" page instead of the user list. Unauthenticated users are
// redirected to /login by the middleware, and this page checks the
// session itself too (defense in depth).
// Test Admin Mode (demo mode, see DEMO_MODE.md): a signed-out visitor
// with the demo cookie sees the same page with sample users and
// sample pending reviews, the settings form filled from the static
// business values (never the real site_settings row), and every
// button disabled — nothing here can change anything.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isAuthConfigured } from "@/lib/auth/server";
import { getDemoOrSession } from "@/lib/auth/demo";
import { type Profile } from "@/lib/auth/session";
import { defaultSettings, getSiteSettings } from "@/lib/site-settings";
import { getPendingReviews } from "@/lib/reviews-server";
import { SAMPLE_PENDING_REVIEWS, SAMPLE_PROFILES } from "@/lib/demo-data";
import { setUserActive, setUserRole, saveSiteSettings, approveReview, deleteReview } from "./actions";
import InviteStaffForm from "@/components/InviteStaffForm";
import DemoBanner from "@/components/DemoBanner";
import DemoPopover from "@/components/DemoPopover";

export default async function AdminPage() {
  // Test Admin Mode: a signed-out visitor with the demo cookie sees
  // the sample users and sample pending reviews below and never
  // touches the real profiles or reviews tables. The
  // auth-configured, session and admin-role checks only apply outside
  // demo mode, so demo works whether or not Supabase is set up.
  const { demo, session } = await getDemoOrSession();
  if (!demo && !isAuthConfigured()) {
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

  if (!demo) {
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
  }

  let profiles: Profile[] = [];
  let storageError = "";
  if (demo) {
    profiles = SAMPLE_PROFILES;
  } else if (!isSupabaseConfigured()) {
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

  // In demo mode the settings form shows the static business values
  // (lib/business.ts) — the real site_settings row is never read.
  const settings = demo ? defaultSettings() : await getSiteSettings();
  const pendingReviews = demo
    ? SAMPLE_PENDING_REVIEWS
    : await getPendingReviews();

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <h1>Admin — Lumen Hair Studio</h1>
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
          Signed in as <strong>{session.user.email}</strong> (admin).
        </p>
      ) : null}
      <p>
        <Link href="/admin/products">Manage products →</Link>
      </p>

      <section>
        <h2>Users</h2>
        <p>
          Staff join by admin invite only — there is no public staff
          signup. Invite someone below and they start as staff; promote
          them here when they need admin access. Customers sign up
          themselves from the site and appear here as “customer”;
          promote one to staff here if they join the team. Deactivated
          accounts cannot sign in. The last remaining active admin
          cannot be demoted or deactivated.
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
                  <th className="actions-cell"><span className="actions-header-label">Actions</span></th>
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
                    <td className="actions-cell">
                      <form action={setUserRole} style={{ display: "inline", marginRight: 8 }}>
                        <input type="hidden" name="userId" value={p.id} />
                        <input
                          type="hidden"
                          name="role"
                          value={
                            p.role === "admin"
                              ? "staff"
                              : p.role === "customer"
                                ? "staff"
                                : "admin"
                          }
                        />
                        <DemoPopover enabled={demo}>
                          <button type="submit" disabled={demo}>
                            {p.role === "admin"
                              ? "Demote to staff"
                              : p.role === "customer"
                                ? "Make staff"
                                : "Make admin"}
                          </button>
                        </DemoPopover>
                      </form>
                      <form action={setUserActive} style={{ display: "inline" }}>
                        <input type="hidden" name="userId" value={p.id} />
                        <input type="hidden" name="active" value={p.is_active ? "false" : "true"} />
                        <DemoPopover enabled={demo}>
                          <button type="submit" disabled={demo}>
                            {p.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </DemoPopover>
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
        {demo ? (
          <DemoPopover block>
            <p>
              Demo mode — inviting staff is disabled. Nothing is sent.
            </p>
          </DemoPopover>
        ) : (
          <InviteStaffForm />
        )}
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
        {!demo && !isSupabaseConfigured() ? (
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
                  <th className="actions-cell"><span className="actions-header-label">Actions</span></th>
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
                    <td className="actions-cell">
                      <form action={approveReview} style={{ display: "inline", marginRight: 8 }}>
                        <input type="hidden" name="reviewId" value={r.id} />
                        <DemoPopover enabled={demo}>
                          <button type="submit" disabled={demo}>Approve</button>
                        </DemoPopover>
                      </form>
                      <form action={deleteReview} style={{ display: "inline" }}>
                        <input type="hidden" name="reviewId" value={r.id} />
                        <DemoPopover enabled={demo}>
                          <button type="submit" disabled={demo}>Delete</button>
                        </DemoPopover>
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
        {/* One popover for the whole form: every input and the save
            button are disabled in demo mode, so hovering anywhere on
            the form explains why. */}
        <DemoPopover enabled={demo} block>
          <form action={saveSiteSettings} className="lead-form">
            <label>
              Business name
              <input name="business_name" required defaultValue={settings.business_name} disabled={demo} />
            </label>
            <label>
              Phone
              <input name="phone" required defaultValue={settings.phone} disabled={demo} />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={settings.email} disabled={demo} />
            </label>
            <label>
              Address
              <input name="address" defaultValue={settings.address} disabled={demo} />
            </label>
            <label>
              Hours
              <input name="hours" defaultValue={settings.hours} disabled={demo} />
            </label>
            <button type="submit" disabled={demo}>Save settings</button>
          </form>
        </DemoPopover>
      </section>
    </main>
  );
}

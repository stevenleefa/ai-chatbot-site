import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import DemoBanner from "@/components/DemoBanner";
import { getDemoOrSession } from "@/lib/auth/demo";
import { getDisplayName, getInitials } from "@/lib/user-display";

// Staff profile page: signed-in only (middleware guards /profile,
// and this page redirects to /login as well, defence in depth).
// Shows the account's name, email and role, a link to change the
// password, and a sign-out button. The name is derived from the
// account email — profiles store no display name (see
// lib/user-display.ts).
//
// Test Admin Mode (demo mode, see DEMO_MODE.md): a signed-out visitor
// with the demo cookie sees a demo profile card instead — "Demo
// Admin" with an exit link, and no change-password or sign-out, since
// there is no real account behind it.
export default async function ProfilePage() {
  const { demo, session } = await getDemoOrSession();
  if (demo) {
    return (
      <main id="main-content">
        <h1>Profile</h1>
        <DemoBanner />
        <div className="card">
          <p>
            <span className="avatar" style={{ background: "var(--rose)" }}>
              TA
            </span>
          </p>
          <p>
            <strong>Name:</strong> Demo Admin
          </p>
          <p>
            <strong>Email:</strong> demo@lumenhairstudio.example
          </p>
          <p>
            <strong>Role:</strong> Admin (demo)
          </p>
          <p>
            <Link href="/api/demo?on=0">Exit Test Admin Mode</Link>
          </p>
        </div>
      </main>
    );
  }
  if (!session) {
    redirect("/login");
  }
  // The staff profile page is owner-only: a customer has their own
  // area instead (defence in depth behind the middleware).
  if (session.profile.role === "customer") redirect("/my-account");
  const name = getDisplayName(session.user);
  const initials = getInitials(name);
  return (
    <main id="main-content">
      <h1>Profile</h1>
      <div className="card">
        <p>
          <span className="avatar" style={{ background: "var(--rose)" }}>
            {initials}
          </span>
        </p>
        <p>
          <strong>Name:</strong> {name}
        </p>
        <p>
          <strong>Email:</strong> {session.profile.email}
        </p>
        <p>
          <strong>Role:</strong>{" "}
          {session.profile.role === "admin" ? "Admin" : "Staff"}
        </p>
        <p>
          <Link href="/auth/update-password">Change password</Link>
        </p>
        <p>
          <SignOutButton />
        </p>
      </div>
    </main>
  );
}

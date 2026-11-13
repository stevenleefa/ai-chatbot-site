import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { getSession } from "@/lib/auth/session";
import { getDisplayName, getInitials } from "@/lib/user-display";

// Staff profile page: signed-in only (middleware guards /profile,
// and this page redirects to /login as well, defence in depth).
// Shows the account's name, email and role, a link to change the
// password, and a sign-out button. The name is derived from the
// account email — profiles store no display name (see
// lib/user-display.ts).
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
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

import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";

// Owner links in the site nav. A Server Component: it reads the session
// on the server, so the nav shows the right links without a client fetch.
// Rendered by the (server) homepage and passed into the client HomeClient
// as a prop — client components cannot import server components directly.
export default async function AuthNav() {
  const session = await getSession();
  if (!session) {
    return <a href="/login">Owner sign in</a>;
  }
  return (
    <>
      <a href="/dashboard">Dashboard</a>
      <form action="/auth/signout" method="post" style={{ display: "inline" }}>
        <button
          type="submit"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            font: "inherit",
            fontWeight: 600,
            color: "var(--plum)",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </form>
    </>
  );
}

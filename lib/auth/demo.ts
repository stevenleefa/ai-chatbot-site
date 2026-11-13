// Test Admin Mode (demo mode) — server helpers.
//
// These read the request (cookies + session), so they only run in
// server components, route handlers and server actions — never in the
// browser and never in the middleware (which reads the cookie from the
// request itself and uses the pure helpers in lib/auth/demo-cookie.ts).
// The decision itself (isDemoMode) is pure and lives in demo-cookie.ts
// so it can be unit-tested.
import { cookies } from "next/headers";
import { getSession, type Session } from "./session";
import { DEMO_COOKIE, isDemoMode } from "./demo-cookie";

// Demo mode plus the session, in one call, so owner pages do not
// fetch the session twice. Demo is only on for a signed-out visitor
// with the cookie set (see demo-cookie.ts).
export async function getDemoOrSession(): Promise<{
  demo: boolean;
  session: Session | null;
}> {
  const session = await getSession();
  const cookieValue = cookies().get(DEMO_COOKIE)?.value;
  return { demo: isDemoMode(cookieValue, session), session };
}

// Refuse a server action while demo mode is on. The admin actions
// already require an admin session (requireRole), so this is defence
// in depth with a clear message: a demo visitor has no session, so
// the role check would refuse them anyway — this names the reason
// instead of "Admins only." A real admin who happens to have the
// demo cookie set is NOT blocked: they have a session, so demo mode
// is off for them (see isDemoMode).
export async function assertNotDemo(): Promise<void> {
  const { demo } = await getDemoOrSession();
  if (demo) {
    throw new Error("Demo mode — this doesn't change anything.");
  }
}

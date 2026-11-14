// Test Admin Mode (demo mode) — the cookie that turns it on.
//
// Pure constants and helpers: no Next.js imports, no Supabase, so the
// middleware (edge runtime) and Jest can both use this file. The
// Session import is type-only (erased at compile), so it never pulls
// the auth server client in.
//
// The safety invariant lives here: demo mode is only ever "on" for a
// signed-OUT visitor. A signed-in user — staff, admin or customer —
// is always judged by their real role, so the demo cookie can never
// upgrade a customer or downgrade staff. And a visitor setting the
// cookie by hand only ever gets the demo: the owner pages serve
// sample data (lib/demo-data.ts) whenever demo mode is on, and never
// read the real Supabase tables.
import type { Session } from "./session";

export const DEMO_COOKIE = "lumen-demo";

// How long the demo cookie lasts once set (7 days). The visitor can
// leave any time sooner from the hamburger menu ("Exit Test Admin
// Mode"), which clears it.
export const DEMO_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function isDemoCookieValue(value: string | undefined): boolean {
  return value === "1";
}

// Demo mode is on exactly when the cookie is set AND there is no
// Supabase session. A session means a real signed-in user, and their
// real role decides what they see — never the cookie.
export function isDemoMode(
  cookieValue: string | undefined,
  session: Session | null
): boolean {
  return session === null && isDemoCookieValue(cookieValue);
}

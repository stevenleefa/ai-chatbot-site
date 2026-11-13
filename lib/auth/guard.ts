// Pure owner-route gating: no Supabase calls, no Next.js imports, so
// it is unit-testable in Jest (__tests__/guard.test.ts). The middleware
// (middleware.ts) calls this after it has fetched the user and their
// profiles row; the owner pages and API routes repeat the customer
// check themselves as defence in depth (see lib/auth/session.ts
// requireStaff()).
//
// The rule: an owner route needs a signed-in user with an active
// profile whose role is staff or admin. A customer (role 'customer')
// is signed in and active, but is NOT staff — they are sent to their
// own area (/my-account) instead of an owner page, and get a 401 from
// an API route. Signed-out users go to /login (pages) or get a 401
// (API routes), exactly as before.
import type { UserRole } from "./session";

// Every route only staff/admin may open. /my-account is deliberately
// NOT here: it is the customer area, guarded by its own page check.
export const OWNER_PREFIXES = [
  "/leads",
  "/dashboard",
  "/admin",
  "/customers",
  "/appointments",
  "/employees",
  "/orders",
  "/profile",
  "/api/leads",
] as const;

export function isOwnerPath(pathname: string): boolean {
  return OWNER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export type OwnerGuardDecision =
  | { action: "allow" }
  | { action: "redirect"; to: string }
  | { action: "unauthorized" };

export type GuardProfile = {
  role: UserRole;
  is_active: boolean;
};

// Decide what happens when someone requests an owner route.
//   profile is null when there is no signed-in user, or when the user
//   has no profiles row yet (auth-schema.sql not run, or the trigger
//   did not fire). A missing/inactive profile is treated as
//   unauthorized, never as a crash.
//   demo is the Test Admin Mode cookie (lib/auth/demo-cookie.ts). A
//   signed-out visitor with it may browse the owner routes and see
//   sample data — that is the whole point of demo mode. It only ever
//   applies without a session: a signed-in user (staff, admin or
//   customer) is always judged by their real role below, so demo can
//   never upgrade a customer or downgrade staff.
export function decideOwnerAccess(
  pathname: string,
  input: { hasUser: boolean; profile: GuardProfile | null; demo?: boolean }
): OwnerGuardDecision {
  if (!isOwnerPath(pathname)) return { action: "allow" };
  const isApi = pathname.startsWith("/api/");
  if (input.demo && !input.hasUser) return { action: "allow" };
  if (!input.hasUser) {
    return isApi
      ? { action: "unauthorized" }
      : {
          action: "redirect",
          to: `/login?next=${encodeURIComponent(pathname)}`,
        };
  }
  if (!input.profile || !input.profile.is_active) {
    return isApi
      ? { action: "unauthorized" }
      : { action: "redirect", to: "/login?error=account-inactive" };
  }
  if (input.profile.role === "customer") {
    return isApi
      ? { action: "unauthorized" }
      : { action: "redirect", to: "/my-account" };
  }
  return { action: "allow" };
}

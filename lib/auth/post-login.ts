// Where the single sign-in page (/login) sends a user right after
// sign-in. Pure function — no Supabase calls, no Next.js imports —
// so it is unit-testable in Jest (__tests__/post-login.test.ts).
//
// The role comes from the user's profiles row (read through RLS
// after sign-in — a user reads only their own row), never from a
// client-side claim, and the redirect waits until it is known:
// /login does not redirect on a guessed role. Owner pages still
// enforce the role server-side (middleware + requireStaff), so this
// only routes — a customer who somehow lands on an owner URL is
// bounced to /my-account by the middleware anyway.
//
// Rules:
//   - ?next= is honoured only when the user is allowed to reach it:
//     staff/admin may reach owner pages (and /dashboard); a
//     customer may reach any non-owner page. A customer whose next
//     points at an owner page goes to /my-account instead; a staff
//     member whose next points at /my-account goes to /dashboard
//     instead (staff use the owner area, not the customer page).
//   - With no usable next, staff/admin go to /dashboard and
//     customers to /my-account.
//   - next values that would loop back to a sign-in page (/login
//     or the old /my-account/sign-in, which itself redirects to
//     /login) are treated as no next.
import { isOwnerPath } from "./guard";
import { safeRedirect } from "@/lib/security";
import type { UserRole } from "./session";

export function postSignInDestination(
  role: UserRole,
  next: string | null | undefined
): string {
  // safeRedirect keeps only same-origin paths; anything missing or
  // unsafe falls back to "" here (not /dashboard — the default
  // depends on the role, below).
  const target = safeRedirect(next, "");
  const path = target.split(/[?#]/)[0];
  const isSignInPage = path === "/login" || path === "/my-account/sign-in";
  if (!target || isSignInPage) {
    return role === "customer" ? "/my-account" : "/dashboard";
  }
  if (role === "customer") {
    return isOwnerPath(path) ? "/my-account" : target;
  }
  if (path === "/my-account" || path.startsWith("/my-account/")) {
    return "/dashboard";
  }
  return target;
}

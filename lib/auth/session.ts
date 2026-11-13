import type { User } from "@supabase/supabase-js";
import { getAuthServerClient } from "./server";

// Session helpers for server code (pages, route handlers, server actions).
// A user counts as authorized only when BOTH are true:
//   1. they have a valid Supabase Auth session, and
//   2. they have a row in public.profiles with is_active = true.
// If the auth tables were never set up (supabase/auth-schema.sql not run
// yet), the profile lookup fails and the user is treated as unauthorized
// instead of crashing.
//
// Roles: 'admin' and 'staff' are the owner side (staff join by admin
// invite only); 'customer' is the public side (customers sign up
// themselves from /my-account/sign-up, see CUSTOMER_ACCOUNTS.md). A customer
// is authorized for their own area (/my-account) but must never reach
// an owner route — the middleware enforces that with
// lib/auth/guard.ts, and the owner pages repeat the check themselves
// (requireStaff below) as defence in depth.

export type UserRole = "admin" | "staff" | "customer";

export type Profile = {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type Session = {
  user: User;
  profile: Profile;
};

export async function getSession(): Promise<Session | null> {
  const supabase = getAuthServerClient();
  if (!supabase) return null;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, is_active, created_at")
    .eq("id", user.id)
    .single();
  if (profileError || !profile || !profile.is_active) return null;
  return { user, profile: profile as Profile };
}

export async function getAuthUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getUserProfile(): Promise<Profile | null> {
  const session = await getSession();
  return session?.profile ?? null;
}

// Returns the session when the user is signed in with an active profile,
// otherwise null. Use in server pages / route handlers (defense in depth
// behind the middleware redirect).
export async function requireAuth(): Promise<Session | null> {
  return getSession();
}

// Same as requireAuth, plus a role check. "staff" means any active
// staff/admin (never a customer); "admin" means an active admin only.
export async function requireRole(
  role: UserRole
): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (role === "admin" && session.profile.role !== "admin") return null;
  if (
    role === "staff" &&
    session.profile.role !== "admin" &&
    session.profile.role !== "staff"
  ) {
    return null;
  }
  if (role === "customer" && session.profile.role !== "customer") {
    return null;
  }
  return session;
}

// The session when the caller is signed in with an active staff/admin
// profile, otherwise null. Use in owner pages and API routes (defence
// in depth behind the middleware): a customer session is a real
// session, but it is not staff, so it must not pass an owner check.
export async function requireStaff(): Promise<Session | null> {
  return requireRole("staff");
}

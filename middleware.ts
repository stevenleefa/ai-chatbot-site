import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideOwnerAccess } from "@/lib/auth/guard";
import { DEMO_COOKIE, isDemoCookieValue } from "@/lib/auth/demo-cookie";
import type { UserRole } from "@/lib/auth/session";

// Refreshes the Supabase session on every request and guards the owner
// areas (/leads, /dashboard, /admin, /customers, /appointments,
// /employees, /orders, /profile, /api/leads/*). Public routes — the homepage, /products,
// booking form /api/lead, static assets, /login and /auth/*, and the
// customer pages (/my-account/*) — are never blocked here. There is no
// public staff signup: staff join only by admin invite (see AUTH.md).
// Customers sign up themselves from /my-account/sign-up (see
// CUSTOMER_ACCOUNTS.md) and are blocked from every owner route below: a
// customer session is a real session, but it is not staff.
//
// Test Admin Mode (demo mode, see DEMO_MODE.md): a signed-out visitor
// with the lumen-demo cookie may browse the owner routes and see
// sample data only — the owner pages serve lib/demo-data.ts whenever
// demo mode is on, and never read the real Supabase tables. The
// decision function only honours the cookie without a session, so a
// signed-in user is always judged by their real role.
//
// When Supabase auth is not configured, every request passes through
// untouched: the public site works, and the protected pages show their
// own "Auth not configured" notice instead of crashing. Demo mode
// still works then: the owner pages check the demo cookie before the
// auth-configured check, so a recruiter sees sample data either way.
const PROTECTED_PREFIXES = ["/leads", "/dashboard", "/admin", "/customers", "/appointments", "/employees", "/orders", "/profile", "/api/leads"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() also refreshes the session cookies when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isProtectedPath(request.nextUrl.pathname)) return response;

  // A session alone is not enough: the user also needs an active
  // profiles row, and a customer is not staff. A missing row
  // (auth-schema.sql not run yet, or the trigger did not fire) or
  // is_active = false is unauthorized, not a crash. The decision
  // itself lives in lib/auth/guard.ts so it can be unit-tested
  // (__tests__/guard.test.ts); this only maps it onto a response.
  // API routes answer 401 JSON; pages redirect (to /login when
  // signed out or inactive, to /my-account when a customer asks
  // for an owner page).
  let profile: { is_active: boolean; role: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_active, role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const decision = decideOwnerAccess(request.nextUrl.pathname, {
    hasUser: Boolean(user),
    profile: profile
      ? {
          role: profile.role as UserRole,
          is_active: profile.is_active as boolean,
        }
      : null,
    // Test Admin Mode: a signed-out visitor with the demo cookie may
    // browse the owner routes and see sample data. The decision
    // function only honours it without a session, so it can never
    // upgrade a signed-in customer or downgrade staff.
    demo: isDemoCookieValue(request.cookies.get(DEMO_COOKIE)?.value),
  });
  if (decision.action === "unauthorized") {
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 401 }
    );
  }
  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|hero.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

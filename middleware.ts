import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and guards the owner
// areas (/leads, /dashboard, /admin, /customers, /appointments,
// /employees, /api/leads/*). Public routes — the homepage, /api/chat, the public
// booking form /api/lead, static assets, /login and /auth/* — are never
// blocked here. There is no public signup page: staff join only by
// admin invite (see AUTH.md).
//
// When Supabase auth is not configured, every request passes through
// untouched: the public site works, and the protected pages show their
// own "Auth not configured" notice instead of crashing.
const PROTECTED_PREFIXES = ["/leads", "/dashboard", "/admin", "/customers", "/appointments", "/employees", "/api/leads"];

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

  // API routes answer 401 JSON; pages redirect to /login.
  if (!user) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // A session alone is not enough: the user also needs an active
  // profiles row. A missing row (auth-schema.sql not run yet, or the
  // trigger did not fire) or is_active = false is unauthorized, not a
  // crash — send them to /login with a note.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Account is not active." },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "account-inactive");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|hero.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

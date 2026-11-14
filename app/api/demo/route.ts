import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, DEMO_MAX_AGE_SECONDS } from "@/lib/auth/demo-cookie";

// Test Admin Mode on/off. GET /api/demo?on=1 sets the demo cookie and
// sends the visitor to the owner dashboard; GET /api/demo?on=0 clears
// it and sends them back to the public homepage.
//
// A GET is enough here: this only sets a client preference cookie —
// it never reads or writes real data. Demo mode is safe by design:
// the owner pages serve sample data (lib/demo-data.ts) whenever the
// cookie is on, and the middleware only lets the cookie open owner
// routes for a signed-out visitor (see lib/auth/guard.ts). Anyone
// can set the cookie by hand and the result is the same demo.
export async function GET(request: NextRequest) {
  const on = request.nextUrl.searchParams.get("on") === "1";
  const response = NextResponse.redirect(
    new URL(on ? "/dashboard" : "/", request.url)
  );
  if (on) {
    response.cookies.set(DEMO_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_MAX_AGE_SECONDS,
    });
  } else {
    response.cookies.set(DEMO_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

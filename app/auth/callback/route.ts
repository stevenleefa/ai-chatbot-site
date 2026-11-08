import { NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/auth/server";

// Exchanges the ?code= from Supabase email links (staff invite,
// password recovery) for a session, then redirects to ?next=
// or /dashboard. Used by the email links Supabase sends.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = getAuthServerClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?error=setup-incomplete", request.url)
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=callback", request.url)
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}

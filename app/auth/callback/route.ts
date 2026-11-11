import { NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/auth/server";
import { safeRedirect } from "@/lib/security";

// Exchanges the ?code= from Supabase email links (password recovery)
// for a session, then redirects to ?next= or /dashboard. Used by the
// email links Supabase sends. Staff invites do NOT come through here:
// the server-side invite API sends the session as #access_token in the
// URL hash (no ?code=), which a server route cannot see — invite links
// go straight to /auth/update-password instead.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // ?next= must be a same-origin path (safeRedirect). Before this fix
  // an absolute URL (?next=https://evil.example) was passed straight
  // to new URL() and redirected the user off-site after sign-in.
  const next = safeRedirect(requestUrl.searchParams.get("next"));

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

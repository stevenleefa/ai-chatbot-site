import { NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/auth/server";
import { safeRedirect } from "@/lib/security";

// Signs the user out and sends them back to the homepage — or to
// ?next= when it is a safe same-origin path (the menu's "Switch
// user" posts here with ?next=/login, so a different staff member
// can sign in). POST only, so a link prefetch can never sign
// someone out by accident.
export async function POST(request: Request) {
  const supabase = getAuthServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const next = new URL(request.url).searchParams.get("next");
  return NextResponse.redirect(
    new URL(safeRedirect(next, "/"), request.url)
  );
}

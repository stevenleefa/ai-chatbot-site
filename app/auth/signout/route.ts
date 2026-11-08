import { NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/auth/server";

// Signs the user out and sends them back to the homepage. POST only, so
// a link prefetch can never sign someone out by accident.
export async function POST(request: Request) {
  const supabase = getAuthServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url));
}

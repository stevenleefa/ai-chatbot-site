import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Server Supabase client (anon / publishable key only, with the user's
// session in cookies). This is the client for auth: getUser(), sign-in
// state, and RLS-enforced queries as the signed-in user. It is NOT the
// service-role client in lib/supabase.ts — that one bypasses RLS and
// stays server-only for lead storage.
// Returns null when Supabase auth is not configured, so protected pages
// can show a "not configured" notice instead of crashing.
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getAuthServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The middleware refreshes the session cookies instead.
        }
      },
    },
  });
}

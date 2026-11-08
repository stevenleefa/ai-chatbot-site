import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client (anon / publishable key only). The anon key is
// public by design — Row Level Security still applies to every query, and
// the service-role key is never used here. Returns null when Supabase
// auth is not configured, so the login page can show a
// "not configured" notice instead of crashing.
let browserClient: SupabaseClient | null | undefined;

export function getBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    browserClient = null;
    return null;
  }
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

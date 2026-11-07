import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client (service_role). This file must only be
// imported from server code (API routes / server components) — never from
// a client component — because SUPABASE_SERVICE_ROLE_KEY bypasses Row
// Level Security and must never reach the browser.
// Returns null when the keys are missing, so the site still works in
// demo mode: leads fall back to console.log and are not saved.
export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

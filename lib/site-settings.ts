import { business } from "./business";
import { getServerSupabase, isSupabaseConfigured } from "./supabase";

// Site settings: the public contact info shown on the homepage. The
// single row in public.site_settings (id = 1) wins when it is set;
// otherwise the static values in lib/business.ts are the fallback, so
// the site works with no database at all. An admin edits the row on
// /admin. Services and prices are NOT here — they still live in
// lib/business.ts (see AUTH.md).
export type SiteSettings = {
  business_name: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
};

export function defaultSettings(): SiteSettings {
  return {
    business_name: business.name,
    phone: business.phone,
    email: business.email,
    address: business.address,
    hours: business.hours,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const fallback = defaultSettings();
  if (!isSupabaseConfigured()) return fallback;
  const supabase = getServerSupabase();
  if (!supabase) return fallback;
  const { data, error } = await supabase
    .from("site_settings")
    .select("business_name, phone, email, address, hours")
    .eq("id", 1)
    .single();
  if (error || !data) return fallback;
  return {
    business_name: data.business_name || fallback.business_name,
    phone: data.phone || fallback.phone,
    email: data.email || fallback.email,
    address: data.address || fallback.address,
    hours: data.hours || fallback.hours,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth/session";

// Admin-only server actions for /admin. Every action re-checks that the
// caller is an active admin (defense in depth behind the middleware and
// the page check), and writes with the service-role client. The last
// remaining active admin can never be demoted or deactivated — otherwise
// the site would have no admin left to fix it.
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const supabase = getServerSupabase();
  if (!supabase) return false;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  const admins = (data ?? []).map((row) => row.id);
  return admins.length === 1 && admins[0] === userId;
}

export async function setUserRole(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Admins only.");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || (role !== "admin" && role !== "staff")) {
    throw new Error("A user and a valid role (admin or staff) are required.");
  }
  if (role === "staff" && (await isLastActiveAdmin(userId))) {
    throw new Error("Cannot demote the last active admin.");
  }
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("Leads storage is not configured.");
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw new Error("Could not update role.");
  revalidatePath("/admin");
}

export async function setUserActive(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Admins only.");
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!userId) throw new Error("A user is required.");
  if (!active && (await isLastActiveAdmin(userId))) {
    throw new Error("Cannot deactivate the last active admin.");
  }
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("Leads storage is not configured.");
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId);
  if (error) throw new Error("Could not update account status.");
  revalidatePath("/admin");
}

export async function saveSiteSettings(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Admins only.");
  const fields = {
    business_name: String(formData.get("business_name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    hours: String(formData.get("hours") ?? "").trim(),
  };
  if (!fields.business_name || !fields.phone) {
    throw new Error("Business name and phone are required.");
  }
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("Leads storage is not configured.");
  const { error } = await supabase.from("site_settings").upsert({
    id: 1,
    ...fields,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not save site settings.");
  revalidatePath("/admin");
  revalidatePath("/");
}

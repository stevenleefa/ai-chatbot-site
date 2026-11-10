"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getServerSupabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/site-settings";

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

export async function saveSiteSettings(formData: FormData) {  const session = await requireRole("admin");
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

// Invite a staff member by email. Admin-only. Uses the service-role
// client (server only — the key never reaches the browser) to send a
// Supabase invite email. The link in the email goes straight to
// /auth/update-password, where the invited person sets their first
// password — it does NOT go through /auth/callback, because the
// server-side invite API sends the session as #access_token in the URL
// hash (no ?code= for the callback to exchange), and a server route
// cannot see the hash. The update-password page reads the hash and
// establishes the session itself. Their profiles row is created by the
// trigger as 'staff'.
// Returns a result object (instead of throwing) so the form can show
// the outcome inline.
export async function inviteUser(
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const session = await requireRole("admin");
  if (!session) return { ok: false, message: "Admins only." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      ok: false,
      message: "Leads storage is not configured (SUPABASE_SERVICE_ROLE_KEY missing).",
    };
  }
  // Build the site origin from the request so the invite link works in
  // dev (localhost:3000) and on the live Vercel URL with no hardcoded
  // domain. Behind a proxy, x-forwarded-proto carries the real scheme.
  const headerList = headers();
  const host = headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (!host) {
    return { ok: false, message: "Could not work out the site address." };
  }
  // Personalise the invite email: pass the business name and the
  // inviter as user metadata, so the Supabase "Invite user" email
  // template can name them ({{ .Data.business_name }} and
  // {{ .Data.invited_by }}). The template itself is edited in the
  // Supabase dashboard — the text to paste is in
  // supabase/email-templates/invite-user.html. The data is only used
  // by the email; the profile is still created by the trigger.
  const settings = await getSiteSettings();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${proto}://${host}/auth/update-password`,
    data: {
      business_name: settings.business_name,
      invited_by: session.user.email ?? "the site owner",
    },
  });
  if (error) {
    return {
      ok: false,
      message:
        error.message === "User already registered"
          ? "That email already has an account — find them in the Users list above."
          : `Could not send the invite: ${error.message}`,
    };
  }
  revalidatePath("/admin");
  return {
    ok: true,
    message: `Invite sent to ${email}. They will start as staff once they accept it and set a password.`,
  };
}

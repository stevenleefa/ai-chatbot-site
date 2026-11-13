// Display name + initials for a signed-in staff member, used by
// the header menu (components/HamburgerMenu.tsx) and /profile.
// Profiles store no display name (see supabase/auth-schema.sql:
// id, email, role, is_active, created_at only), so the name is
// derived: the full_name in the auth user's metadata when one was
// set, otherwise the part of the email before the "@", with
// separators turned into spaces and the first letter capitalised
// ("live4zz" becomes "Live4zz" — there is no real name to show
// until one is stored on the account).
import type { User } from "@supabase/supabase-js";

export function getDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;
  const local = (user.email ?? "").split("@")[0] ?? "";
  const spaced = local.replace(/[._\-+]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Staff";
}

export function getInitials(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const cleaned = displayName.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 2).toUpperCase() || "?";
}

import { redirect } from "next/navigation";
import { safeRedirect } from "@/lib/security";

// The old customer sign-in address. There is one sign-in now
// (/login) for staff and customers alike — this page just sends
// everyone there, keeping ?next= so a bookmarked or redirected
// link still lands where it was going. ?next= is sanitised here
// (same-origin paths only); /login sanitises it again before
// routing by role.
export default function CustomerSignInRedirect({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const rawNext =
    typeof searchParams?.next === "string" ? searchParams.next : undefined;
  const next = safeRedirect(rawNext, "");
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}

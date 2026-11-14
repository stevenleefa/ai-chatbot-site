// Always fetch fresh: do not let Next.js cache the catalogue in
// .next, or /settings can show a stale product list after the
// studio edits a product in /admin/products.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import PersonalizationSettings from "@/components/PersonalizationSettings";
import FavoriteProducts from "@/components/FavoriteProducts";
import { getCatalogue } from "@/lib/products-db";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import { BUSINESS_NAME } from "@/lib/leads";

// Settings for any signed-in account — customers, staff and admin
// alike. Display (theme, fonts, text size, accessibility, voice),
// preferred stylist, email notifications and favorite products.
// This page checks the session itself — the middleware does not
// guard /settings, because customers must be able to reach it and
// signed-out visitors are sent to the customer sign-in, not the
// owner sign-in (the same pattern as /my-account). The scalar
// settings are saved per user in localStorage and, when the studio
// has run the migrations, in the customer_preferences table via
// /api/preferences (see PERSONALIZATION.md). Favorites live in
// their own table, user_favorites, via /api/favorites (see
// lib/favorites.ts).
export default async function SettingsPage() {
  if (!isAuthConfigured()) {
    return (
      <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
        <h1>Settings — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert" className="alert-note">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so your settings are hidden. See AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/my-account/sign-in?next=/settings");

  const catalogue = await getCatalogue();
  const products = catalogue.filter((p) => p.active);

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <h1>Settings — {BUSINESS_NAME}</h1>
      <p>
        <Link href="/my-account">← Back to My account</Link>
      </p>

      <section>
        <h2>Display, voice, stylist &amp; notifications</h2>
        <p>
          <small>
            Your colour theme, fonts, text size and accessibility
            options, how the assistant sounds, your preferred stylist
            and whether we email you. They apply across the whole site
            as soon as you pick them, and are saved on this device —
            and to your account when the studio has set up Supabase
            storage, so they follow you to another device.
          </small>
        </p>
        <PersonalizationSettings />
      </section>

      <section>
        <h2>Favorite products</h2>
        <p>
          <small>
            The products you keep coming back to. Favorite them here
            or tap the heart on a product in the shop — they are
            saved to your account.
          </small>
        </p>
        <FavoriteProducts products={products} />
      </section>
    </main>
  );
}

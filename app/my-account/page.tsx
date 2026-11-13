// Always fetch fresh bookings and orders: do not let Next.js cache
// the Supabase query in .next, or /my-account can show a stale list
// after a new booking or payment.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isAuthConfigured } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import { getDisplayName, getInitials } from "@/lib/user-display";
import {
  getCustomerBookings,
  getCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-account";
import { BUSINESS_NAME } from "@/lib/leads";
import { formatPrice } from "@/lib/products";
import { fmtDate } from "@/lib/format";

// The customer area for Lumen Hair Studio. Any signed-in account with
// an active profile can open it — customers see their own bookings
// and orders here; a staff member who lands here sees only their own
// too (matched by their email, the same as a customer). The owner
// pages are separate and stay staff-only (see CUSTOMER_ACCOUNTS.md).
// Access: sign in at /my-account/sign-in (or create an account at
// /my-account/sign-up). This page checks the session itself — the
// middleware does not guard /my-account, because customers must be
// able to reach it and signed-out visitors are sent to the customer
// sign-in, not the owner sign-in.
function orderStatusBadge(status: CustomerOrder["status"]) {
  if (status === "paid") return <span className="badge badge-paid">Paid</span>;
  if (status === "cancelled")
    return <span className="badge badge-overdue">Cancelled</span>;
  return <span className="badge badge-unpaid">Pending</span>;
}

export default async function MyAccountPage() {
  if (!isAuthConfigured()) {
    return (
      <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
        <h1>My account — {BUSINESS_NAME}</h1>
        <p>
          <Link href="/">← Back to the site</Link>
        </p>
        <p role="alert" className="alert-note">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then, so your bookings and orders are hidden. See
          AUTH.md.
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect("/my-account/sign-in?next=/my-account");

  const email = session.profile.email;
  const name = getDisplayName(session.user);
  const initials = getInitials(name);
  const roleLabel =
    session.profile.role === "customer"
      ? "Customer"
      : session.profile.role === "admin"
        ? "Admin"
        : "Staff";

  // Bookings and orders are matched by the email on the verified
  // session — never by anything the visitor typed — so a customer
  // only ever sees their own (lib/customer-account.ts).
  let bookings: Awaited<ReturnType<typeof getCustomerBookings>> = [];
  let orders: CustomerOrder[] = [];
  if (isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    bookings = await getCustomerBookings(supabase!, email);
    orders = await getCustomerOrders(supabase!, email);
  }

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <h1>My account — {BUSINESS_NAME}</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      <div className="card">
        <p>
          <span className="avatar" style={{ background: "var(--rose)" }}>
            {initials}
          </span>
        </p>
        <p>
          <strong>Name:</strong> {name}
        </p>
        <p>
          <strong>Email:</strong> {email}
        </p>
        <p>
          <strong>Account:</strong> {roleLabel}
        </p>
        <p>
          <Link href="/auth/update-password">Change password</Link>
        </p>
        <p>
          <SignOutButton />
        </p>
      </div>

      <section>
        <h2>My bookings</h2>
        <p>
          <small>
            Bookings are matched to your account by email. A booking
            made with a phone number instead of this email address
            won’t appear here — ask the studio if one is missing.
          </small>
        </p>
        {!isSupabaseConfigured() ? (
          <p>
            Bookings are not being recorded yet — the studio has not
            set up Supabase storage. See AUTH.md.
          </p>
        ) : bookings.length === 0 ? (
          <p>
            No bookings yet.{" "}
            <Link href="/#booking">Book a service</Link>
          </p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="My bookings table">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{fmtDate(b.created_at.slice(0, 10))}</td>
                    <td>{b.service}</td>
                    <td>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>My orders</h2>
        <p>
          <small>
            Orders from the shop (in-store pickup), matched to your
            account by email. An order is <em>pending</em> until Stripe
            confirms the payment, then <em>paid</em>.
          </small>
        </p>
        {!isSupabaseConfigured() ? (
          <p>
            Orders are not being recorded yet — the studio has not set
            up Supabase storage. See SHOP.md.
          </p>
        ) : orders.length === 0 ? (
          <p>
            No orders yet. <Link href="/products">Browse products</Link>
          </p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="My orders table">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Items</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{fmtDate(o.created_at.slice(0, 10))}</td>
                    <td>
                      {(o.items ?? [])
                        .map((item) => `${item.name} × ${item.quantity}`)
                        .join(", ")}
                    </td>
                    <td className="num">{formatPrice(o.total_cents)}</td>
                    <td>{orderStatusBadge(o.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

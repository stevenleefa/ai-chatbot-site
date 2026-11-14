// Always fetch fresh orders: do not let Next.js cache the Supabase
// query in .next, or /orders can show a stale status after a payment.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import DemoBanner from "@/components/DemoBanner";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isAuthConfigured } from "@/lib/auth/server";
import { getDemoOrSession } from "@/lib/auth/demo";
import { SAMPLE_ORDERS } from "@/lib/demo-data";
import { BUSINESS_NAME, BUSINESS_SLUG } from "@/lib/leads";
import { formatPrice } from "@/lib/products";
import { fmtDate } from "@/lib/format";

// Owner orders list for Lumen Hair Studio. Server component: it
// reads only this business's orders (business = "salon"), newest
// first. Orders are created by /api/checkout (status "pending") and
// marked "paid" by /products/success only after Stripe confirms the
// payment (see SHOP.md).
// Access: sign in at /login. The middleware redirects signed-out users
// there; this page checks the session itself too (defense in depth).
type OrderItem = {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
};

type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  items: OrderItem[];
  total_cents: number;
  stripe_session_id: string | null;
  status: "pending" | "paid" | "cancelled";
};

function statusBadge(status: Order["status"]) {
  if (status === "paid") return <span className="badge badge-paid">Paid</span>;
  if (status === "cancelled")
    return <span className="badge badge-overdue">Cancelled</span>;
  return <span className="badge badge-unpaid">Pending</span>;
}

export default async function OrdersPage() {
  // Test Admin Mode: a signed-out visitor with the demo cookie sees
  // the sample orders below and never touches the real orders table.
  // The auth-configured and session checks only apply outside demo
  // mode, so demo works whether or not Supabase is set up.
  const { demo, session } = await getDemoOrSession();
  if (!demo) {
    if (!isAuthConfigured()) {
      return (
        <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
          <h1>Orders — {BUSINESS_NAME}</h1>
          <p>
            <Link href="/">← Back to the site</Link>
          </p>
          <p role="alert" className="alert-note">
            <strong>Auth is not configured.</strong> Add
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
            .env.local and restart the dev server. Sign-in is unavailable
            until then, so the orders list is hidden. See AUTH.md.
          </p>
        </main>
      );
    }

    if (!session) redirect("/login?next=/orders");
    // Defence in depth behind the middleware: a customer must never
    // see the owner orders list (their own orders are on /my-account).
    if (session.profile.role === "customer") redirect("/my-account");
  }

  let orders: Order[] = [];
  if (demo) {
    orders = SAMPLE_ORDERS;
  } else if (isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("orders")
      .select(
        "id,created_at,customer_name,customer_email,items,total_cents,stripe_session_id,status"
      )
      .eq("business", BUSINESS_SLUG)
      .order("created_at", { ascending: false });
    if (!error && data) orders = data as Order[];
  }

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <h1>Orders — {BUSINESS_NAME}</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      {demo && <DemoBanner />}
      {demo ? (
        <p>
          <strong>Test Admin Mode</strong> — sample data, no real account.
        </p>
      ) : session ? (
        <p>
          Signed in as <strong>{session.user.email}</strong> (
          {session.profile.role}).
        </p>
      ) : null}
      {!demo && !isSupabaseConfigured() && (
        <p>
          Supabase is not configured, so no orders are being recorded
          yet. See SHOP.md to set it up — run
          supabase/orders-schema.sql in the SQL Editor.
        </p>
      )}
      <p>
        Orders from the shop (in-store pickup). An order is{" "}
        <em>pending</em> when the checkout started and <em>paid</em>{" "}
        once Stripe confirms the payment — the success page marks it
        paid, never the shopper.
      </p>
      {orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Orders table">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
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
                    {o.customer_name}
                    <br />
                    <span className="dash-table sub">{o.customer_email}</span>
                  </td>
                  <td>
                    {(o.items ?? [])
                      .map((item) => `${item.name} × ${item.quantity}`)
                      .join(", ")}
                  </td>
                  <td className="num">{formatPrice(o.total_cents)}</td>
                  <td>{statusBadge(o.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import ClearCart from "@/components/ClearCart";
import { formatPrice } from "@/lib/products";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

// Checkout success landing page. Takes ?session_id= from the Stripe
// Checkout redirect and verifies the payment server-side with the
// Stripe secret key — it NEVER trusts a query param like ?paid=true.
// When Stripe confirms payment_status "paid", the matching order
// row (if one was recorded) is marked paid for the owner list.
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id ?? "";

  if (!sessionId) {
    return (
      <main id="main-content">
        <h1>Thank you</h1>
        <p>
          There is no checkout session to confirm here. If you just
          paid, check your email for the Stripe receipt, or{" "}
          <Link href="/products">back to the shop</Link>.
        </p>
      </main>
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return (
      <main id="main-content">
        <h1>Thank you</h1>
        <p>
          Payments are not set up on this site, so this checkout
          cannot be confirmed. If you were charged, contact the
          studio at (555) 014-8890.
        </p>
      </main>
    );
  }

  let paid = false;
  let amountTotal: number | null = null;
  let customerEmail: string | null = null;
  let lookupFailed = false;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    paid = session.payment_status === "paid";
    amountTotal = session.amount_total;
    customerEmail = session.customer_details?.email ?? null;
  } catch {
    lookupFailed = true;
  }

  if (lookupFailed) {
    return (
      <main id="main-content">
        <h1>Thank you</h1>
        <p>
          We could not confirm this payment with Stripe just now.
          Check your email for the Stripe receipt — if you were
          charged and have no receipt, call the studio at
          (555) 014-8890.
        </p>
      </main>
    );
  }

  if (paid && isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    // Mark the recorded order paid. If the row was never recorded
    // (the insert failed at checkout time), this just matches
    // nothing — the Stripe confirmation below is still the truth.
    await supabase!
      .from("orders")
      .update({ status: "paid" })
      .eq("stripe_session_id", sessionId);
  }

  return (
    <main id="main-content">
      <ClearCart />
      <h1>{paid ? "Thank you — order confirmed" : "Payment not confirmed"}</h1>
      {paid ? (
        <>
          <p>
            Your payment went through
            {amountTotal !== null ? ` (${formatPrice(amountTotal)})` : ""}.
            Your order is ready for pickup at 12 Maple Street, Monday
            to Saturday, 9am to 6pm — bring this page or your email
            receipt.
          </p>
          {customerEmail && (
            <p>A receipt was sent to {customerEmail}.</p>
          )}
        </>
      ) : (
        <p>
          Stripe has not confirmed this payment as paid. If you were
          charged, check your email for the receipt or call the
          studio at (555) 014-8890.
        </p>
      )}
      <p>
        <Link href="/products">Back to the shop</Link> ·{" "}
        <Link href="/">Back to the site</Link>
      </p>
    </main>
  );
}

import Link from "next/link";

// Checkout cancelled landing page. Stripe sends the shopper here
// when they back out of the hosted checkout — nothing was charged,
// and the cart is still saved in the browser, so they can pick up
// where they left off.
export default function CheckoutCancelledPage() {
  return (
    <main id="main-content">
      <h1>Checkout cancelled</h1>
      <p>
        No problem — nothing was charged, and your cart is still
        saved, so you can come back and check out whenever you like.
      </p>
      <p>
        <Link href="/products">Back to the shop</Link> ·{" "}
        <Link href="/">Back to the site</Link>
      </p>
    </main>
  );
}

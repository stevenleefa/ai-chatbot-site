import ShopClient from "@/components/ShopClient";
import { getCatalogue } from "@/lib/products-db";
import { isStripeConfigured } from "@/lib/stripe";

// Public shop page: the full product range, a cart (saved in
// localStorage), and Stripe Checkout for secure card payment.
// Fulfilment is in-store pickup at 12 Maple Street — no delivery,
// no shipping fees. When Stripe is not configured the products and
// the cart still work; checkout just says it is not set up yet
// (see SHOP.md). The catalogue comes from Supabase when configured
// (lib/products-db.ts) and falls back to the static list otherwise;
// only active products are shown — removed products (active=false)
// never appear here, and the cart drops them on load.
export default async function ProductsPage() {
  const catalogue = await getCatalogue();
  const products = catalogue.filter((p) => p.active);
  return (
    <main id="main-content">
      <h1>Shop — Lumen Hair Studio</h1>
      <p>
        The products the studio uses and sells — the same shampoo,
        colour care and styling range your stylist reaches for. Buy
        here and pick up in the studio at 12 Maple Street; payment is
        taken securely by card through Stripe, and this site never
        sees your card number.
      </p>
      <ShopClient products={products} checkoutEnabled={isStripeConfigured()} />
    </main>
  );
}

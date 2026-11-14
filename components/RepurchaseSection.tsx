"use client";

import { useState } from "react";
import Link from "next/link";
import {
  formatPrice,
  getDiscountLabel,
  getSalePriceCents,
  type Product,
} from "@/lib/products";
import type { Bundle } from "@/lib/repurchase";
import { readStoredCart, writeStoredCart } from "@/lib/saved-carts-client";

// Previously purchased + "Complete the routine" bundle (see
// lib/repurchase.ts for how the lists are built server-side).
// Both add to the same localStorage cart the shop uses
// (key `lumen-cart`), so a Buy again / bundle add shows up in the
// shop cart and at checkout. Adding never removes what is already
// in the cart — it adds one more of the product. The confirmation
// is text (role="status"), never colour alone, with a link to
// /products to check out.
function addToStoredCart(ids: string[]): void {
  const cart = readStoredCart();
  for (const id of ids) {
    cart[id] = Math.min(99, (cart[id] ?? 0) + 1);
  }
  writeStoredCart(cart);
}

export default function RepurchaseSection({
  previouslyPurchased,
  bundle,
}: {
  previouslyPurchased: Product[];
  bundle: Bundle;
}) {
  const [message, setMessage] = useState("");

  function buyAgain(product: Product) {
    addToStoredCart([product.id]);
    setMessage(`Added ${product.name} to your cart.`);
  }

  function addBundle() {
    if (bundle.products.length === 0) return;
    addToStoredCart(bundle.products.map((p) => p.id));
    setMessage(
      `Added the ${bundle.title.toLowerCase()} bundle (${bundle.products.length} items) to your cart.`
    );
  }

  return (
    <>
      <section aria-labelledby="repurchase-heading">
        <h2 id="repurchase-heading">Previously purchased</h2>
        {previouslyPurchased.length === 0 ? (
          <p>
            Nothing here yet — products from your past orders will show
            here, ready to buy again.{" "}
            <Link href="/products">Browse products</Link>
          </p>
        ) : (
          <ul>
            {previouslyPurchased.map((p) => {
              const label = getDiscountLabel(p);
              return (
                <li key={p.id}>
                  {p.name} — {formatPrice(getSalePriceCents(p))}
                  {label ? ` (${label})` : ""}{" "}
                  {!p.inStock ? (
                    <span>Out of stock — check back soon.</span>
                  ) : (
                    <button type="button" onClick={() => buyAgain(p)}>
                      Buy again
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="bundle-heading">
        <h2 id="bundle-heading">Complete the routine</h2>
        <p>
          <strong>{bundle.title}</strong> —{" "}
          {bundle.source === "last-order"
            ? "the products from your most recent order, in one tap."
            : "the studio's starter routine: shampoo, conditioner and leave-in treatment, in one tap."}
        </p>
        {bundle.products.length === 0 ? (
          <p>
            No bundle available right now — every product in the set is
            out of stock or no longer available.
          </p>
        ) : (
          <>
            <ul>
              {bundle.products.map((p) => (
                <li key={p.id}>
                  {p.name} — {formatPrice(getSalePriceCents(p))}
                </li>
              ))}
            </ul>
            <p>
              Bundle price:{" "}
              <strong>{formatPrice(bundle.totalCents)}</strong>
            </p>
            <p>
              <button type="button" onClick={addBundle}>
                Add bundle to cart
              </button>
            </p>
          </>
        )}
        {bundle.skipped.length > 0 && (
          <p>
            <small>
              Not included: {bundle.skipped.join(", ")} — out of stock or
              no longer available.
            </small>
          </p>
        )}
      </section>

      {message && (
        <p role="status">
          {message} <Link href="/products">View your cart</Link>
        </p>
      )}
    </>
  );
}

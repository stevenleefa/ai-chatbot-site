"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CART_STORAGE_KEY,
  PRODUCTS,
  formatPrice,
  getProduct,
  type Product,
} from "@/lib/products";
import ReviewPopups from "./ReviewPopups";

// Shop: product grid + cart + checkout (in-store pickup).
// The cart lives in client state and is saved to localStorage so it
// survives a refresh (and is cleared by the success page after a
// paid checkout). Checkout goes to /api/checkout, which validates
// the cart server-side and creates a Stripe Checkout Session — the
// card is taken on Stripe's hosted page, never here (see SHOP.md).
// Fulfilment is in-store pickup at 12 Maple Street: no delivery, no
// shipping fees. The checkout collects a name + email so the studio
// knows whose pickup order it is.

type Cart = Record<string, number>; // product id -> quantity

function productInitials(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? words[1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

export default function ShopClient({
  products,
  checkoutEnabled,
}: {
  products: Product[];
  checkoutEnabled: boolean;
}) {
  const [cart, setCart] = useState<Cart>({});
  const [loaded, setLoaded] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutState, setCheckoutState] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  // Load the saved cart once, on mount. Unknown product ids and
  // out-of-range quantities are dropped (a stale save from an older
  // catalogue must not break the page).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Cart;
        const clean: Cart = {};
        for (const [id, qty] of Object.entries(parsed)) {
          if (
            getProduct(id) &&
            Number.isInteger(qty) &&
            qty >= 1 &&
            qty <= 99
          ) {
            clean[id] = qty;
          }
        }
        setCart(clean);
      }
    } catch {
      // Corrupted save — start with an empty cart.
    }
    setLoaded(true);
  }, []);

  // Save the cart whenever it changes (after the initial load, so
  // the empty starting state never wipes a saved cart).
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage unavailable — the cart just lives for this page load.
    }
  }, [cart, loaded]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: getProduct(id), qty }))
        .filter(
          (l): l is { product: Product; qty: number } => l.product !== null
        ),
    [cart]
  );
  const totalCents = lines.reduce(
    (sum, l) => sum + l.product.priceCents * l.qty,
    0
  );

  function qtyFor(id: string): number {
    return quantities[id] ?? 1;
  }

  function addToCart(id: string) {
    const q = Math.min(99, Math.max(1, qtyFor(id) || 1));
    setCart((prev) => ({ ...prev, [id]: Math.min(99, (prev[id] ?? 0) + q) }));
    setQuantities((prev) => ({ ...prev, [id]: 1 }));
  }

  function setLineQty(id: string, qty: number) {
    if (qty <= 0) {
      const { [id]: _removed, ...rest } = cart;
      setCart(rest);
      return;
    }
    setCart((prev) => ({ ...prev, [id]: Math.min(99, qty) }));
  }

  function removeLine(id: string) {
    const { [id]: _removed, ...rest } = cart;
    setCart(rest);
  }

  async function checkout() {
    if (checkingOut) return;
    if (!checkoutEnabled) {
      setCheckoutState(
        "Checkout is not set up yet — the studio is still setting up online payments. Your cart is saved here; ask in the studio in the meantime."
      );
      return;
    }
    if (lines.length === 0) return;
    if (!name.trim() || !email.trim()) {
      setCheckoutState(
        "Add your name and email so the studio knows whose pickup order this is."
      );
      return;
    }
    setCheckingOut(true);
    setCheckoutState("Starting secure checkout…");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.product.id, quantity: l.qty })),
          name: name.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        // Stripe's hosted checkout page takes the card — this site
        // never sees card numbers.
        window.location.href = data.url;
        return;
      }
      setCheckoutState(
        data.error ?? "Checkout could not start. Please try again."
      );
    } catch {
      setCheckoutState("Checkout could not start. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <>
      <div className="product-grid">
        {products.map((p) => (
          <article key={p.id} className="product-card">
            <div className="product-tile" aria-hidden="true">
              {productInitials(p.name)}
            </div>
            <h3>{p.name}</h3>
            <p className="product-category">{p.category}</p>
            <p>{p.description}</p>
            <p className="price">{formatPrice(p.priceCents)}</p>
            <div className="qty-row">
              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={qtyFor(p.id)}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [p.id]: Math.min(
                        99,
                        Math.max(1, Number(e.target.value) || 1)
                      ),
                    }))
                  }
                />
              </label>
              <button type="button" onClick={() => addToCart(p.id)}>
                Add to cart
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className="cart-section" aria-label="Your cart">
        <h2>Your cart</h2>
        {lines.length === 0 ? (
          <p>Your cart is empty — add something from the range above.</p>
        ) : (
          <>
            <ul className="cart-lines">
              {lines.map((l) => (
                <li key={l.product.id}>
                  <span>
                    {l.product.name} — {formatPrice(l.product.priceCents)}{" "}
                    each
                  </span>
                  <span className="cart-qty">
                    <button
                      type="button"
                      aria-label={`One fewer ${l.product.name}`}
                      onClick={() => setLineQty(l.product.id, l.qty - 1)}
                    >
                      −
                    </button>
                    <span aria-label={`Quantity of ${l.product.name}`}>
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`One more ${l.product.name}`}
                      onClick={() => setLineQty(l.product.id, l.qty + 1)}
                    >
                      +
                    </button>
                  </span>
                  <span>{formatPrice(l.product.priceCents * l.qty)}</span>
                  <button
                    type="button"
                    className="cart-remove"
                    onClick={() => removeLine(l.product.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <p className="cart-total">
              Total: <strong>{formatPrice(totalCents)}</strong>
            </p>
            <p>
              In-store pickup at 12 Maple Street — no delivery, no
              shipping fees. Pay securely by card at checkout, then
              collect your order in the studio.
            </p>
            <div className="lead-form">
              <label>
                Your name
                <input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email for your pickup order
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>
            <p>
              <button
                type="button"
                onClick={checkout}
                disabled={checkingOut || lines.length === 0}
              >
                {checkingOut ? "Starting checkout…" : "Checkout securely"}
              </button>
            </p>
            {!checkoutEnabled && (
              <p>
                Online checkout is not set up yet — the studio is
                still connecting its payments. You can browse the
                range and buy in the studio.
              </p>
            )}
            {checkoutState && <p role="status">{checkoutState}</p>}
          </>
        )}
      </section>

      <ReviewPopups />
    </>
  );
}

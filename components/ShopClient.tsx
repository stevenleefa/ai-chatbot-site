"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CART_STORAGE_KEY,
  formatPrice,
  getDiscountLabel,
  getLineTotalCents,
  getSalePriceCents,
  type Product,
} from "@/lib/products";
import {
  readLocalSavedCarts,
  writeLocalSavedCarts,
} from "@/lib/saved-carts-client";
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
//
// The products here are the ACTIVE catalogue from the server page
// (Supabase when configured, the static list otherwise). Out-of-stock
// products are shown but cannot be bought; the one featured product
// gets a section of its own above the grid. Sale prices come from
// the shared helpers in lib/products.ts — the same helpers the
// server checkout uses, so the price shown and the price charged
// can never disagree (see SHOP.md).

type Cart = Record<string, number>; // product id -> quantity

// Free units in a buyXGetY line, e.g. buy 2 get 1, qty 3 → 1 free.
// Returns 0 for any other sale (or a malformed one, which the
// pricing helpers treat as no sale).
function freeUnitsFor(product: Product, qty: number): number {
  const sale = product.sale;
  if (!sale || sale.type !== "buyXGetY") return 0;
  if (
    !Number.isInteger(sale.buy) ||
    !Number.isInteger(sale.get) ||
    sale.buy <= 0 ||
    sale.get <= 0
  ) {
    return 0;
  }
  return Math.floor(qty / (sale.buy + sale.get)) * sale.get;
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
  const [saveCartName, setSaveCartName] = useState("Saved cart");
  const [saveCartState, setSaveCartState] = useState("");
  const [savingCart, setSavingCart] = useState(false);

  // The catalogue as passed in — the one lookup for everything
  // below, so a product that is not in this list (unknown id, or
  // removed from the shop) is treated as gone everywhere.
  const byId = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const featured = products.find((p) => p.featured) ?? null;

  // Load the saved cart once, on mount. Unknown product ids,
  // removed (inactive) products, out-of-stock products and
  // out-of-range quantities are dropped (a stale save from an older
  // catalogue — or from before a product sold out — must not break
  // the page or let a shopper check out with something unsellable).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Cart;
        const clean: Cart = {};
        for (const [id, qty] of Object.entries(parsed)) {
          const product = byId.get(id);
          if (
            product &&
            product.active &&
            product.inStock &&
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
    // The catalogue is fixed for this page load; re-running on
    // every products identity change would wipe the cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .map(([id, qty]) => ({ product: byId.get(id) ?? null, qty }))
        .filter(
          (l): l is { product: Product; qty: number } => l.product !== null
        ),
    [cart, byId]
  );
  const totalCents = lines.reduce(
    (sum, l) => sum + getLineTotalCents(l.product, l.qty),
    0
  );

  function qtyFor(id: string): number {
    return quantities[id] ?? 1;
  }

  function addToCart(id: string) {
    const product = byId.get(id);
    // The button is disabled for out-of-stock products; this is the
    // backstop so nothing can add one through any other path.
    if (!product || !product.active || !product.inStock) return;
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

  // Save this cart. Signed in with Supabase configured, it goes to
  // the account (POST /api/saved-carts) and can be restored from
  // /my-account. Otherwise — signed out, or storage unconfigured —
  // it is saved on this device only, under `lumen-saved-carts`
  // (a separate key from the live cart), and the confirmation says
  // so plainly. Saving never changes the live cart.
  async function saveCurrentCart() {
    if (savingCart || lines.length === 0) return;
    const label = saveCartName.trim() || "Saved cart";
    const items = lines.map((l) => ({ id: l.product.id, quantity: l.qty }));
    setSavingCart(true);
    setSaveCartState("Saving…");
    const saveLocally = () => {
      const saved = readLocalSavedCarts();
      saved.unshift({
        name: label,
        items,
        savedAt: new Date().toISOString(),
      });
      writeLocalSavedCarts(saved);
      setSaveCartState(
        `Saved “${label}” on this device only — sign in to save it to your account, and find it under Saved carts in My account.`
      );
    };
    try {
      const res = await fetch("/api/saved-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: label, items }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveCartState(
          `Saved “${label}” to your account — find it under Saved carts in My account.`
        );
        return;
      }
      if (res.status === 401 || (res.status === 503 && data.configured === false)) {
        saveLocally();
        return;
      }
      setSaveCartState(data.error ?? "Could not save this cart.");
    } catch {
      saveLocally();
    } finally {
      setSavingCart(false);
    }
  }

  // The price line for one product: a sale shows the sale price
  // next to the struck-through original price, plus the offer in
  // plain text (never colour alone). A buyXGetY sale does not change
  // the unit price — the free units come off the line total — so it
  // shows the full price plus the offer text.
  function priceLine(p: Product) {
    const label = getDiscountLabel(p);
    if (label && p.sale?.type === "percent") {
      return (
        <p className="price">
          <span>{formatPrice(getSalePriceCents(p))}</span>{" "}
          <s className="price-original">{formatPrice(p.priceCents)}</s>{" "}
          <span className="sale-label">{label}</span>
        </p>
      );
    }
    if (label) {
      return (
        <p className="price">
          <span>{formatPrice(p.priceCents)}</span>{" "}
          <span className="sale-label">{label}</span>
        </p>
      );
    }
    return <p className="price">{formatPrice(p.priceCents)}</p>;
  }

  // One product card (grid, and the featured card below — same
  // controls, so the featured product behaves exactly like the
  // others). Out-of-stock products show an "Out of stock" badge and
  // a plain-text reason, and their quantity picker and Add button
  // are real `disabled` controls, not just styled ones.
  function productCard(p: Product, featuredCard: boolean) {
    const label = getDiscountLabel(p);
    return (
      <article
        key={p.id}
        className={featuredCard ? "product-card featured-card" : "product-card"}
      >
        <div className="product-tile" aria-hidden="true">
          <img src={p.image} alt="" loading="lazy" />
          {label && (
            <span className="sale-ribbon" aria-hidden="true">
              {label}
            </span>
          )}
        </div>
        <h3>{p.name}</h3>
        <p className="product-category">{p.category}</p>
        {p.featured && (
          <p>
            <span className="badge badge-featured">Featured</span>
          </p>
        )}
        {!p.inStock && (
          <p>
            <span className="badge badge-out-of-stock">Out of stock</span>
          </p>
        )}
        <p>{p.description}</p>
        {priceLine(p)}
        {!p.inStock && (
          <p className="out-of-stock-note">
            Out of stock — check back soon, or ask in the studio.
          </p>
        )}
        <div className="qty-row">
          <label>
            Quantity
            <input
              type="number"
              min={1}
              max={99}
              value={qtyFor(p.id)}
              disabled={!p.inStock}
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
          <button
            type="button"
            onClick={() => addToCart(p.id)}
            disabled={!p.inStock}
          >
            Add to cart
          </button>
        </div>
      </article>
    );
  }

  return (
    <>
      {featured && (
        <section
          className="featured-section"
          aria-labelledby="featured-heading"
        >
          <h2 id="featured-heading">Featured</h2>
          {productCard(featured, true)}
        </section>
      )}

      <div className="product-grid">
        {products.map((p) => productCard(p, false))}
      </div>

      <section className="cart-section" aria-label="Your cart">
        <h2>Your cart</h2>
        {lines.length === 0 ? (
          <p>Your cart is empty — add something from the range above.</p>
        ) : (
          <>
            <ul className="cart-lines">
              {lines.map((l) => {
                const free = freeUnitsFor(l.product, l.qty);
                const label = getDiscountLabel(l.product);
                return (
                  <li key={l.product.id}>
                    <span>
                      {l.product.name} —{" "}
                      {formatPrice(getSalePriceCents(l.product))} each
                      {label ? ` (${label})` : ""}
                    </span>
                    {free > 0 && (
                      <span className="cart-sale-note">
                        {label} — {free} free
                      </span>
                    )}
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
                    <span>
                      {formatPrice(getLineTotalCents(l.product, l.qty))}
                    </span>
                    <button
                      type="button"
                      className="cart-remove"
                      onClick={() => removeLine(l.product.id)}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
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
            <div className="lead-form">
              <label>
                Save this cart as
                <input
                  value={saveCartName}
                  onChange={(e) => setSaveCartName(e.target.value)}
                  placeholder="Saved cart"
                />
              </label>
              <button
                type="button"
                onClick={saveCurrentCart}
                disabled={savingCart || lines.length === 0}
              >
                {savingCart ? "Saving…" : "Save cart"}
              </button>
            </div>
            {saveCartState && <p role="status">{saveCartState}</p>}
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

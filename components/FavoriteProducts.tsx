// Favorite products on the Settings page (/settings).
// Lists the signed-in customer's favorites (photo, name, price,
// Remove) and lets them add one more from the shop range. The ids
// come from GET /api/favorites; the product details come from the
// catalogue the server page passes in, so a product removed from
// the shop simply does not render (its id is dropped on load).
// Signed out, or with Supabase unconfigured, the route answers
// 401 / { configured: false } and the section says so instead of
// erroring — the page itself is signed-in only, so 401 here means
// the session expired mid-visit.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  formatPrice,
  getSalePriceCents,
  type Product,
} from "@/lib/products";

export default function FavoriteProducts({
  products,
}: {
  products: Product[];
}) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState("");
  const [addId, setAddId] = useState("");

  const byId = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  // Drop ids that are not in this catalogue (a product removed
  // from the shop since it was favorited).
  const favorites = useMemo(
    () =>
      favoriteIds
        .map((id) => byId.get(id))
        .filter((p): p is Product => p !== undefined),
    [favoriteIds, byId],
  );
  const addable = useMemo(
    () => products.filter((p) => !favoriteIds.includes(p.id)),
    [products, favoriteIds],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const obj =
          typeof data === "object" && data !== null
            ? (data as Record<string, unknown>)
            : {};
        if (obj.configured === false || !Array.isArray(obj.favorites)) {
          setUnavailable(true);
          return;
        }
        setFavoriteIds(
          (obj.favorites as unknown[]).filter(
            (id): id is string => typeof id === "string",
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeFavorite(
    productId: string,
    method: "POST" | "DELETE",
    verb: string,
  ) {
    setStatus("Saving…");
    try {
      const res = await fetch("/api/favorites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.favorites)) {
        setStatus(
          data.error ?? "Could not save this favorite — please try again.",
        );
        return;
      }
      setFavoriteIds(
        (data.favorites as unknown[]).filter(
          (id): id is string => typeof id === "string",
        ),
      );
      const product = byId.get(productId);
      setStatus(
        product
          ? `${verb} ${product.name}.`
          : "Favorite saved.",
      );
    } catch {
      setStatus("Could not save this favorite — please try again.");
    }
  }

  function removeFavorite(id: string) {
    void changeFavorite(id, "DELETE", "Removed");
  }

  function addFavorite() {
    if (!addId) return;
    void changeFavorite(addId, "POST", "Added");
    setAddId("");
  }

  if (!loaded) {
    return <p>Loading your favorite products…</p>;
  }
  if (unavailable) {
    return (
      <p>
        Favorite products aren&apos;t set up yet — the studio has not
        set up Supabase storage. See SHOP.md.
      </p>
    );
  }

  return (
    <div>
      {favorites.length === 0 ? (
        <p>
          No favorite products yet. Add one below, or tap the heart on
          a product in the <Link href="/products">shop</Link>.
        </p>
      ) : (
        <ul className="favorite-list">
          {favorites.map((p) => (
            <li key={p.id} className="favorite-item">
              <img src={p.image} alt="" loading="lazy" />
              <span>
                <strong>{p.name}</strong> —{" "}
                {formatPrice(getSalePriceCents(p))}
              </span>
              <button type="button" onClick={() => removeFavorite(p.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {addable.length > 0 && (
        <div className="lead-form">
          <label>
            Add a favorite product
            <select
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
            >
              <option value="">Choose a product…</option>
              {addable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPrice(getSalePriceCents(p))}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addFavorite} disabled={!addId}>
            Add to favorites
          </button>
        </div>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}

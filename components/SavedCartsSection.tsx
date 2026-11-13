"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProduct } from "@/lib/products";
import {
  readLocalSavedCarts,
  readStoredCart,
  writeLocalSavedCarts,
  writeStoredCart,
  type LocalSavedCart,
} from "@/lib/saved-carts-client";

// Saved carts in /my-account. The list comes from GET /api/saved-carts
// when the customer is signed in and Supabase is configured; when
// the API answers { configured: false } (or the request fails) it
// falls back to the on-device list under `lumen-saved-carts` —
// the same key the shop's Save cart control writes to when it
// cannot save to the account. Both lists show the same actions.
//
// RESTORE REPLACES the current cart — it never merges. When the
// current cart is non-empty the customer is asked first
// (window.confirm, the site's existing pattern for a destructive
// action, as in the sign-out dialog), then the saved items are
// written to `lumen-cart` and the customer is linked to /products.
// DELETE removes the cart from the account (API) or from this
// device (local fallback).
type SavedCartRow = {
  key: string;
  id?: string;
  name: string;
  items: { id: string; quantity: number }[];
  savedLabel: string;
  local: boolean;
};

function describeItems(items: { id: string; quantity: number }[]): string {
  return items
    .map((item) => `${getProduct(item.id)?.name ?? item.id} × ${item.quantity}`)
    .join(", ");
}

export default function SavedCartsSection() {
  const [rows, setRows] = useState<SavedCartRow[] | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/saved-carts");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.configured) {
          const carts = (data.carts ?? []) as {
            id: string;
            name: string;
            items: { id: string; quantity: number }[];
            created_at: string;
          }[];
          setLocalMode(false);
          setRows(
            carts.map((c) => ({
              key: c.id,
              id: c.id,
              name: c.name,
              items: c.items ?? [],
              savedLabel: new Date(c.created_at).toLocaleString(),
              local: false,
            }))
          );
          return;
        }
        // Unconfigured Supabase (or any failure): the on-device list.
        setLocalMode(true);
        setRows(
          readLocalSavedCarts().map((c: LocalSavedCart) => ({
            key: c.savedAt,
            name: c.name,
            items: c.items,
            savedLabel: new Date(c.savedAt).toLocaleString(),
            local: true,
          }))
        );
      } catch {
        if (cancelled) return;
        setLocalMode(true);
        setRows(
          readLocalSavedCarts().map((c: LocalSavedCart) => ({
            key: c.savedAt,
            name: c.name,
            items: c.items,
            savedLabel: new Date(c.savedAt).toLocaleString(),
            local: true,
          }))
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function restoreCart(row: SavedCartRow) {
    const current = readStoredCart();
    if (
      Object.keys(current).length > 0 &&
      !window.confirm(
        "Replace your current cart with this saved cart? Anything in your cart now will be removed."
      )
    ) {
      return;
    }
    const next: Record<string, number> = {};
    for (const item of row.items) next[item.id] = item.quantity;
    writeStoredCart(next);
    setIsError(false);
    setMessage(`Restored “${row.name}” to your cart.`);
  }

  async function deleteCart(row: SavedCartRow) {
    if (!row.local && row.id) {
      try {
        const res = await fetch(`/api/saved-carts/${row.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setIsError(true);
          setMessage("Could not delete this saved cart.");
          return;
        }
      } catch {
        setIsError(true);
        setMessage("Could not delete this saved cart.");
        return;
      }
    } else {
      writeLocalSavedCarts(
        readLocalSavedCarts().filter((c) => c.savedAt !== row.key)
      );
    }
    setRows((prev) => (prev ?? []).filter((r) => r.key !== row.key));
    setIsError(false);
    setMessage(`Deleted “${row.name}”.`);
  }

  return (
    <section aria-labelledby="saved-carts-heading">
      <h2 id="saved-carts-heading">Saved carts</h2>
      {localMode && (
        <p>
          <small>
            Saved on this device only — sign in with the studio's
            storage set up to save carts to your account.
          </small>
        </p>
      )}
      {rows === null ? (
        <p>Loading saved carts…</p>
      ) : rows.length === 0 ? (
        <p>
          No saved carts yet. Save one from your cart on{" "}
          <Link href="/products">the shop page</Link>.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.key}>
              <strong>{row.name}</strong> — {describeItems(row.items)}
              <br />
              <small>Saved {row.savedLabel}</small>{" "}
              <button type="button" onClick={() => restoreCart(row)}>
                Restore
              </button>{" "}
              <button type="button" onClick={() => deleteCart(row)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role={isError ? "alert" : "status"}>
          {message}{" "}
          {!isError && message.startsWith("Restored") && (
            <Link href="/products">View your cart</Link>
          )}
        </p>
      )}
    </section>
  );
}

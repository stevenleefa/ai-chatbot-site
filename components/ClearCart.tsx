"use client";

import { useEffect } from "react";
import { CART_STORAGE_KEY } from "@/lib/products";

// Clears the saved shop cart after a successful checkout, so the
// next visit starts with an empty cart. Rendered (invisibly) by the
// success page only.
export default function ClearCart() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode, etc.) — nothing to clear.
    }
  }, []);
  return null;
}

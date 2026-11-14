// PersonalizationProvider — applies the customer's saved display
// preferences site-wide. On mount it reads localStorage
// ("lumen-preferences") and calls applyPreferences, which sets the
// data attributes on <html> that app/globals.css reads. It renders
// no visible UI.
//
// This does NOT fetch the account preferences: the signed-in
// customer's account copy is loaded by components/PersonalizationSettings
// (on /my-account), which applies it and writes it to localStorage —
// so the provider then picks it up on the next page load. The
// pre-paint script below covers the first paint before React runs.
//
// WIRING (coordinator — this file is NOT wired into the layout by
// this change; see PERSONALIZATION.md): render <PersonalizationProvider />
// in app/layout.tsx and add <PersonalizationScript /> inside <head>.
"use client";

import { useEffect } from "react";
import {
  PERSONALIZATION_PREPAINT_SCRIPT,
  applyPreferences,
  readStoredPreferences,
  syncThemeColorMeta,
} from "@/lib/personalization";

export default function PersonalizationProvider() {
  useEffect(() => {
    applyPreferences(readStoredPreferences());
  }, []);
  // Toggling dark/light mode (components/ThemeToggle.tsx) changes
  // data-theme on <html> without calling applyPreferences, so the
  // browser chrome colour (theme-color meta tag) would go stale.
  // Watch data-theme and re-sync the chrome colour when it flips.
  // applyPreferences already syncs it when the theme itself changes.
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-theme") syncThemeColorMeta();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return null;
}

/** The pre-paint inline script for <head> (see lib/personalization.ts
 * PERSONALIZATION_PREPAINT_SCRIPT). It reads localStorage before first
 * paint and sets the same data attributes, so there is no flash of
 * the default theme — mirroring the dark-mode script in the layout. */
export function PersonalizationScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: PERSONALIZATION_PREPAINT_SCRIPT }}
    />
  );
}

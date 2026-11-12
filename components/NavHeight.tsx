"use client";

import { useEffect } from "react";

// The fixed top nav (SiteNav) wraps to two rows at most widths — the
// brand + five links + seven owner buttons do not fit on one row
// below about 1450px — so its real height (one row ~64px, two rows
// ~108px, more on a narrow phone) is not a constant the CSS can
// guess. Measure it in the browser and write it into --nav-height
// on <html>: body padding-top, the sticky dashboard tabs
// (top: var(--nav-height)) and scroll margins all read that
// variable, so the tabs stick exactly below the nav instead of
// sliding underneath it. Before this, --nav-height was a fixed
// 64px (108px only below 640px), so on a normal-width window the
// tabs stuck 44px too high and the fixed nav covered them, and the
// top of every page started 44px under the nav. Runs on mount and
// whenever the header resizes (window resize, font load, wrap
// changes); the CSS 64px stays as the pre-JavaScript fallback.
//
// INVARIANT — do not break this: --nav-height must never feed back
// into the header's own size. .site-nav-inner has no min-height
// (and no other header rule reads the variable), so the height
// measured here is always the header's NATURAL content height and
// a transient tall measurement can shrink back again. An earlier
// version had min-height: var(--nav-height) on .site-nav-inner:
// the measured height held the header up, the observer re-measured
// the inflated height, and --nav-height could only grow — the
// fixed header, body padding-top and sticky tab offset all blew up
// together, and the default align-content: stretch spread the
// header's two rows apart into a huge cream gap at the top while
// scrolling. That is fixed by keeping the measurement one-way.
export default function NavHeight() {
  useEffect(() => {
    // Re-query inside measure (with its own null check) so the
    // height always comes from the header as rendered right now.
    function measure() {
      const header = document.querySelector(".site-nav");
      if (!header) return;
      document.documentElement.style.setProperty(
        "--nav-height",
        `${header.getBoundingClientRect().height}px`
      );
    }
    measure();
    const header = document.querySelector(".site-nav");
    if (!header) return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return null;
}

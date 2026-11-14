"use client";

import { useEffect, useState } from "react";

// The dark-mode row in the hamburger menu (components/HamburgerMenu
// renders this as the row itself). The whole row is ONE button that
// toggles the theme — not a label plus a separate icon button, which
// would be a button inside a button. The label names the mode the
// row switches TO ("Dark mode" in light mode, "Light mode" in dark
// mode); the icon matches (moon when offering dark, sun when
// offering light) and sits in the usual 40px circle, decorative
// (aria-hidden) inside the row. The accessible name is the same
// action ("Switch to dark/light mode") and aria-pressed carries the
// current state, so a screen reader hears the same thing the label
// says. The row is a <button>, so it is keyboard-focusable with the
// site's usual :focus-visible double ring.
//
// The theme lives on <html data-theme="light|dark"> and is applied
// before first paint by the inline script in app/layout.tsx, so this
// component only keeps the attribute, localStorage and the label/icon
// in sync afterwards. localStorage key "lumen-theme" matches
// "lumen-cart" for the shop.
// React 18: useState/useEffect only — no React 19 hooks.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("lumen-theme");
    const current =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(current);
    document.documentElement.setAttribute("data-theme", current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("lumen-theme", next);
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="menu-row menu-theme-row"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
    >
      <span>{dark ? "Light mode" : "Dark mode"}</span>
      <span className="theme-toggle" aria-hidden="true">
        {dark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
    </button>
  );
}

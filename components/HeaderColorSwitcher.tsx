"use client";

import { useEffect, useState } from "react";

// TEMPORARY header-colour switcher in the fixed top nav (rendered by
// the server component components/SiteNav.tsx, next to the theme
// toggle). Three swatches — deep plum, rose, gold — so the owner can
// try each header colour live and pick a winner. The choice lives on
// <html data-header="plum|rose|gold"> and is applied before first
// paint by the inline script in app/layout.tsx, so this component
// only keeps the attribute, localStorage and the pressed state in
// sync afterwards. localStorage key "lumen-header" matches
// "lumen-theme" for the theme and "lumen-cart" for the shop.
// Default with nothing saved: plum.
//
// Once a winner is picked, DELETE this component, hardcode the winner
// as --nav-bg/--nav-fg in app/globals.css, and drop the data-header
// attribute + the pre-paint script in app/layout.tsx.
// React 18: useState/useEffect only — no React 19 hooks.
type HeaderColor = "plum" | "rose" | "gold";

const COLORS: { id: HeaderColor; label: string }[] = [
  { id: "plum", label: "Plum header" },
  { id: "rose", label: "Rose header" },
  { id: "gold", label: "Gold header" },
];

export default function HeaderColorSwitcher() {
  const [color, setColor] = useState<HeaderColor>("plum");

  useEffect(() => {
    const saved = window.localStorage.getItem("lumen-header");
    const current: HeaderColor =
      saved === "plum" || saved === "rose" || saved === "gold"
        ? saved
        : "plum";
    setColor(current);
    document.documentElement.setAttribute("data-header", current);
  }, []);

  function choose(next: HeaderColor) {
    document.documentElement.setAttribute("data-header", next);
    window.localStorage.setItem("lumen-header", next);
    setColor(next);
  }

  return (
    <div className="header-color-switcher" role="group" aria-label="Header colour">
      {COLORS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          data-color={id}
          onClick={() => choose(id)}
          aria-label={label}
          aria-pressed={color === id}
        >
          <span className="header-color-dot" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

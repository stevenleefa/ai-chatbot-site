"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

// Compact search in the fixed header. Client-side only: the items
// (services and products, label + href) come from the server
// component components/SiteNav.tsx, and filtering is a plain
// substring match on the label — no backend search. The dropdown
// lists matching results as links (Tab reaches them); Escape and a
// click outside close it, and picking a result closes it too.
// React 18: useState/useMemo/useRef only — no React 19 hooks.
export type SearchItem = {
  label: string;
  href: string;
};

const MAX_RESULTS = 8;

export default function SearchBox({ items }: { items: SearchItem[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [items, query]);

  const showDropdown = open && query.trim().length > 0;

  // Set when Escape closes the dropdown: focusing the input again
  // (so keyboard users stay in the search) would otherwise fire
  // the input's onFocus and immediately reopen it. The flag makes
  // that one focus a no-op; the next genuine focus opens normally.
  const escapePressedRef = useRef(false);

  function close() {
    setOpen(false);
  }

  // Click-outside closes the dropdown. This has to be a document
  // listener: a mousedown outside the wrapper never reaches the
  // wrapper itself, so a local handler would never fire for it.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open ]);

  return (
    <div
      className="header-search"
      ref={wrapRef}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          escapePressedRef.current = true;
          close();
          inputRef.current?.focus();
        }
      }}
    >
      <label className="visually-hidden" htmlFor="header-search-input">
        Search services and products
      </label>
      <input
        id="header-search-input"
        ref={inputRef}
        type="search"
        className="header-search-input"
        placeholder="Search services & products"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (escapePressedRef.current) {
            escapePressedRef.current = false;
            return;
          }
          setOpen(true);
        }}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="header-search-list"
        autoComplete="off"
      />
      {showDropdown && (
        <div className="header-search-dropdown" id="header-search-list">
          {results.length === 0 ? (
            <p className="header-search-empty">
              No results for &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <ul>
              {results.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      close();
                      setQuery("");
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import SignOutButton from "./SignOutButton";
import DemoPopover from "./DemoPopover";

// The signed-in user, as passed from the server component
// components/SiteNav.tsx (which reads the session the same way
// OwnerNav used to). Null when signed out. The name/initials are
// derived from the account email — profiles store no display name
// (see lib/user-display.ts). Staff and admin see the owner links;
// customers see only their own account rows (My account, Log out)
// and never the owner section.
export type MenuUser = {
  initials: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "customer";
};

// Hamburger menu at the far right of the fixed header. One button
// opens a dropdown panel with the account rows (initials, profile,
// switch user, log out), the dark-mode toggle, the site links and,
// for signed-in staff, the owner links that used to sit in the
// header as OwnerNav pills. A signed-in customer sees only their own
// account rows (My account, Log out) and never the owner links (see
// CUSTOMER_ACCOUNTS.md). A signed-out visitor sees "Test Admin Mode"
// under the sign-in rows: it sets the demo cookie and takes them to
// the owner area with sample data only (see DEMO_MODE.md). While demo
// mode is on, the menu shows a "Test Admin Mode" identity block, an
// "Exit Test Admin Mode" row, and the owner links — so a recruiter
// can browse the whole owner area from the menu. The panel is a plain
// nav of links and buttons (Tab reaches everything); Escape closes it
// and returns focus to the button, and a click outside closes it. The
// sign-out dialog inside the menu owns Escape itself while it is open,
// so the menu's Escape handler leaves it alone (otherwise focus would
// be lost when the dialog tries to return it to its trigger).
// React 18: useState/useEffect/useRef only — no React 19 hooks.
export default function HamburgerMenu({
  user,
  demo = false,
}: {
  user: MenuUser | null;
  // Test Admin Mode is on (demo cookie set, no session). SiteNav
  // computes it — it is false whenever a real session exists.
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  const isCustomer = user?.role === "customer";
  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className="hamburger-button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="site-menu"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <nav className="menu-panel" id="site-menu" aria-label="Account and site menu">
          {user ? (
            <div className="menu-user">
              <span className="menu-avatar" aria-hidden="true">
                {user.initials}
              </span>
              <span className="menu-user-text">
                <span className="menu-user-name">{user.name}</span>
                <span className="menu-user-email">{user.email}</span>
                <span className="menu-user-role">
                  {user.role === "admin"
                    ? "Admin"
                    : user.role === "staff"
                      ? "Staff"
                      : "Customer"}
                </span>
              </span>
            </div>
          ) : demo ? (
            <div className="menu-user">
              <span className="menu-avatar" aria-hidden="true">
                TA
              </span>
              <span className="menu-user-text">
                <span className="menu-user-name">Test Admin Mode</span>
                <span className="menu-user-email">
                  Sample data — no real account
                </span>
                <span className="menu-user-role">Demo</span>
              </span>
            </div>
          ) : (
            <>
              <Link href="/login" className="menu-row" onClick={closeMenu}>
                Sign in
              </Link>
              <Link
                href="/my-account/sign-in"
                className="menu-row"
                onClick={closeMenu}
              >
                Customer sign in
              </Link>
              {/* The entry is a working link, so it is the tab stop
                  itself (focusable={false}) — hovering or tabbing to
                  it shows "For demo purposes only". The asterisks in
                  the label are the marker that this is a demo: no
                  sub-line, the popover carries the explanation. */}
              <DemoPopover focusable={false} block>
                <Link
                  href="/api/demo?on=1"
                  className="menu-row"
                  onClick={closeMenu}
                >
                  *Test Admin Mode*
                </Link>
              </DemoPopover>
            </>
          )}
          <div className="menu-divider" aria-hidden="true" />
          {demo && !user && (
            <>
              <Link
                href="/api/demo?on=0"
                className="menu-row"
                onClick={closeMenu}
              >
                Exit Test Admin Mode
              </Link>
              <Link href="/login" className="menu-row" onClick={closeMenu}>
                Sign in
              </Link>
              <Link
                href="/my-account/sign-in"
                className="menu-row"
                onClick={closeMenu}
              >
                Customer sign in
              </Link>
              <div className="menu-divider" aria-hidden="true" />
            </>
          )}
          {user && isCustomer && (
            <>
              <Link href="/my-account" className="menu-row" onClick={closeMenu}>
                My account
              </Link>
              <SignOutButton
                label="Log out"
                dialogBody="You will need to sign in again to see your bookings and orders."
                className="menu-row"
              />
              <div className="menu-divider" aria-hidden="true" />
            </>
          )}
          {user && !isCustomer && (
            <>
              <Link href="/profile" className="menu-row" onClick={closeMenu}>
                Profile
              </Link>
              <SignOutButton
                label="Switch user"
                next="/login"
                dialogTitle="Switch user?"
                dialogBody="You will be signed out and taken to the sign-in page, so a different staff member can sign in."
                confirmLabel="Switch user"
                className="menu-row"
              />
              <SignOutButton label="Log out" className="menu-row" />
              <div className="menu-divider" aria-hidden="true" />
            </>
          )}
          {/* The dark-mode row IS the theme toggle: one button, the
              whole row, with the label naming the mode it switches
              to (see components/ThemeToggle.tsx). */}
          <ThemeToggle />
          <div className="menu-divider" aria-hidden="true" />
          <Link href="/contact" className="menu-row" onClick={closeMenu}>
            Contact us
          </Link>
          <Link href="/locations" className="menu-row" onClick={closeMenu}>
            Locations
          </Link>
          <Link href="/deals" className="menu-row" onClick={closeMenu}>
            Deals
          </Link>
          {((user && !isCustomer) || demo) && (
            <>
              <div className="menu-divider" aria-hidden="true" />
              <div className="menu-section-label">Owner</div>
              <Link href="/dashboard" className="menu-row" onClick={closeMenu}>
                Dashboard
              </Link>
              <Link href="/leads" className="menu-row" onClick={closeMenu}>
                Leads
              </Link>
              <Link href="/customers" className="menu-row" onClick={closeMenu}>
                Customers
              </Link>
              <Link href="/appointments" className="menu-row" onClick={closeMenu}>
                Appointments
              </Link>
              <Link href="/employees" className="menu-row" onClick={closeMenu}>
                Employees
              </Link>
              <Link href="/orders" className="menu-row" onClick={closeMenu}>
                Orders
              </Link>
              {(user?.role === "admin" || demo) && (
                <Link href="/admin" className="menu-row" onClick={closeMenu}>
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>
      )}
    </div>
  );
}

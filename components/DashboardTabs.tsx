"use client";

import { Children, isValidElement, useRef, useState, type ReactNode } from "react";

// Section tabs for /dashboard. Clicking a section shows just that section
// in place — the page does not jump down to it — and Overview shows
// everything again. The nav sticks to the top while scrolling, so the
// switcher is always in reach, and switching scrolls the nav back into
// view so the chosen section is right in front of you.
const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "sales", label: "Sales" },
  { id: "forecast", label: "Forecast" },
  { id: "pl", label: "P&L" },
  { id: "employees", label: "Employees" },
  { id: "payroll", label: "Payroll" },
  { id: "taxes", label: "Taxes" },
  { id: "inventory", label: "Inventory" },
  { id: "payable", label: "Payable" },
  { id: "receivable", label: "Receivable" },
] as const;

export default function DashboardTabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("overview");
  const navRef = useRef<HTMLElement>(null);

  function show(id: string) {
    setActive(id);
    // Bring the chosen section to the top of the viewport. The nav is
    // sticky, so this is a short scroll up to the controls — never a jump
    // down the page.
    navRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  return (
    <>
      <nav ref={navRef} className="dash-nav" aria-label="Dashboard sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => show(s.id)}
            aria-current={active === s.id ? "true" : undefined}
            className={active === s.id ? "active" : undefined}
          >
            {s.label}
          </button>
        ))}
      </nav>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const id = (child.props as { id?: string }).id;
        // Overview shows everything; any other tab shows only its section.
        // Children without an id (the footer note) show only in Overview.
        const visible = active === "overview" || active === id;
        return <div hidden={!visible}>{child}</div>;
      })}
    </>
  );
}

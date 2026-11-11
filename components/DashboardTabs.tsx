"use client";

import { Children, isValidElement, useRef, useState, type ReactNode } from "react";

// Section tabs for /dashboard. Clicking a section shows just that section
// in place — the page does not jump down to it — and Overview shows
// everything again. The nav sticks to the top while scrolling, so the
// switcher is always in reach, and switching scrolls the nav back into
// view so the chosen section is right in front of you.
//
// This is a real tab pattern (WAI-ARIA tabs): the nav is a tablist,
// each button is a tab with aria-selected and aria-controls pointing
// at its panel, and only the active tab is in the Tab order — Left /
// Right (and Home / End) move between tabs and select the one landed
// on (automatic activation). Overview is one tab too: it controls all
// ten panels at once, so its aria-controls lists every panel id.
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

const PANEL_IDS = SECTIONS.map((s) => `dash-panel-${s.id}`);

export default function DashboardTabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("overview");
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function show(id: string) {
    setActive(id);
    // Bring the chosen section to the top of the viewport. The nav is
    // sticky, so this is a short scroll up to the controls — never a jump
    // down the page.
    navRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  function focusTab(index: number) {
    const tabs = tabRefs.current;
    const tab = tabs[index];
    if (!tab) return;
    tab.focus();
    show(SECTIONS[index].id);
  }

  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    const last = SECTIONS.length - 1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusTab(index === last ? 0 : index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusTab(index === 0 ? last : index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(last);
    }
  }

  return (
    <>
      <nav
        ref={navRef}
        className="dash-nav"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {SECTIONS.map((s, i) => {
          const selected = active === s.id;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`dash-tab-${s.id}`}
              aria-selected={selected}
              aria-controls={
                s.id === "overview"
                  ? PANEL_IDS.join(" ")
                  : `dash-panel-${s.id}`
              }
              tabIndex={selected ? 0 : -1}
              onClick={() => show(s.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={selected ? "active" : undefined}
            >
              {s.label}
            </button>
          );
        })}
      </nav>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const id = (child.props as { id?: string }).id;
        // Overview shows everything; any other tab shows only its section.
        // Children without an id (the footer note) show only in Overview.
        const visible = active === "overview" || active === id;
        if (!id) return <div hidden={!visible}>{child}</div>;
        return (
          <div
            hidden={!visible}
            id={`dash-panel-${id}`}
            role="tabpanel"
            aria-labelledby={`dash-tab-${id}`}
          >
            {child}
          </div>
        );
      })}
    </>
  );
}

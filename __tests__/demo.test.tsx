// Test Admin Mode (demo mode) — lib/auth/demo-cookie.ts, lib/demo-data.ts,
// components/LeadsTable.tsx (demo prop) and components/HamburgerMenu.tsx
// (demo prop). The pure parts only: the cookie helpers, the sample-data
// invariants, and the two components' demo rendering. The server
// helpers (lib/auth/demo.ts) and the route handlers need a live
// Supabase session and cookies, so they are covered by the manual
// checks in DEMO_MODE.md, not here. The guard's demo cases live in
// __tests__/guard.test.ts.
//
// What must hold:
//   - the demo cookie is exactly "1" — anything else is not demo;
//   - demo mode is on only for a signed-OUT visitor with the cookie;
//     a session (staff, admin or customer) always wins, so demo can
//     never upgrade a customer or downgrade staff;
//   - the sample data is fictional (only @example.com /
//     @lumenhairstudio.example addresses), ties out (order totals from
//     the shop catalogue, lead repeat counts computed, not typed),
//     and uses only real services and products;
//   - in demo mode the leads table's status select is disabled, and
//     the menu shows the demo entry / exit rows instead of the
//     signed-in account rows.
import { render, screen, fireEvent } from "@testing-library/react";
import { isDemoCookieValue, isDemoMode } from "@/lib/auth/demo-cookie";
import type { Session } from "@/lib/auth/session";
import {
  SAMPLE_LEADS,
  SAMPLE_ORDERS,
  SAMPLE_PENDING_REVIEWS,
  SAMPLE_PROFILES,
} from "@/lib/demo-data";
import { PRODUCTS } from "@/lib/products";
import { services } from "@/lib/business";
import { isValidStatus } from "@/lib/leads";
import LeadsTable from "@/components/LeadsTable";
import HamburgerMenu, { type MenuUser } from "@/components/HamburgerMenu";
import DemoPopover, {
  DEMO_POPOVER_TITLE,
  DEMO_POPOVER_DETAIL,
} from "@/components/DemoPopover";

// isDemoMode only checks whether the session is null — the contents
// do not matter, so a minimal shape (cast) is enough.
const fakeSession = {
  user: { id: "user-1", email: "maya.chen@lumenhairstudio.example" },
  profile: {
    id: "profile-1",
    email: "maya.chen@lumenhairstudio.example",
    role: "staff",
    is_active: true,
    created_at: "2026-08-01",
  },
} as unknown as Session;

describe("isDemoCookieValue", () => {
  it("only the exact value '1' turns demo mode on", () => {
    expect(isDemoCookieValue("1")).toBe(true);
    expect(isDemoCookieValue(undefined)).toBe(false);
    expect(isDemoCookieValue("0")).toBe(false);
    expect(isDemoCookieValue("yes")).toBe(false);
    expect(isDemoCookieValue("true")).toBe(false);
  });
});

describe("isDemoMode", () => {
  it("is on for a signed-out visitor with the cookie set", () => {
    expect(isDemoMode("1", null)).toBe(true);
  });

  it("is off without the cookie, even signed out", () => {
    expect(isDemoMode(undefined, null)).toBe(false);
    expect(isDemoMode("0", null)).toBe(false);
  });

  it("is off whenever there is a session — demo never overrides a real role", () => {
    expect(isDemoMode("1", fakeSession)).toBe(false);
    const customerSession = {
      ...fakeSession,
      profile: { ...fakeSession.profile, role: "customer" },
    } as unknown as Session;
    expect(isDemoMode("1", customerSession)).toBe(false);
  });
});

describe("SAMPLE_LEADS", () => {
  it("is a small fictional set, newest first, all for this salon", () => {
    expect(SAMPLE_LEADS.length).toBe(9);
    expect(SAMPLE_LEADS.every((l) => l.business === "salon")).toBe(true);
    expect(
      SAMPLE_LEADS.every((l) => l.contact.endsWith("@example.com"))
    ).toBe(true);
    expect(SAMPLE_LEADS.every((l) => isValidStatus(l.status))).toBe(true);
    const dates = SAMPLE_LEADS.map((l) => l.created_at);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("only uses services the salon actually offers", () => {
    const names = services.map((s) => s.name);
    expect(SAMPLE_LEADS.every((l) => names.includes(l.service))).toBe(true);
  });

  it("computes repeat counts: Emma Thompson enquired twice, everyone else once", () => {
    const emma = SAMPLE_LEADS.filter(
      (l) => l.contact === "emma.thompson@example.com"
    );
    expect(emma.length).toBe(2);
    expect(emma.every((l) => l.repeatCount === 2)).toBe(true);
    const others = SAMPLE_LEADS.filter(
      (l) => l.contact !== "emma.thompson@example.com"
    );
    expect(others.every((l) => l.repeatCount === 1)).toBe(true);
  });
});

describe("SAMPLE_ORDERS", () => {
  it("prices every item from the shop catalogue and totals tie out", () => {
    expect(SAMPLE_ORDERS.length).toBe(4);
    for (const order of SAMPLE_ORDERS) {
      expect(order.customer_email.endsWith("@example.com")).toBe(true);
      expect(["pending", "paid", "cancelled"]).toContain(order.status);
      expect(order.stripe_session_id).toBeNull();
      let sum = 0;
      for (const item of order.items) {
        const product = PRODUCTS.find((p) => p.id === item.id);
        expect(product).toBeDefined();
        expect(product!.name).toBe(item.name);
        expect(product!.priceCents).toBe(item.price_cents);
        sum += item.price_cents * item.quantity;
      }
      expect(order.total_cents).toBe(sum);
    }
  });
});

describe("SAMPLE_PROFILES and SAMPLE_PENDING_REVIEWS", () => {
  it("profiles cover all three roles and use only fictional addresses", () => {
    expect(SAMPLE_PROFILES.map((p) => p.role).sort()).toEqual([
      "admin",
      "customer",
      "staff",
      "staff",
    ]);
    expect(
      SAMPLE_PROFILES.every(
        (p) =>
          p.email.endsWith("@example.com") ||
          p.email.endsWith("@lumenhairstudio.example")
      )
    ).toBe(true);
  });

  it("pending reviews are the seed reviews, marked as demo, with valid ratings", () => {
    expect(SAMPLE_PENDING_REVIEWS.length).toBe(3);
    expect(
      SAMPLE_PENDING_REVIEWS.every((r) => r.id.startsWith("demo-pending-"))
    ).toBe(true);
    expect(
      SAMPLE_PENDING_REVIEWS.every((r) => r.rating >= 1 && r.rating <= 5)
    ).toBe(true);
  });
});

describe("LeadsTable in demo mode", () => {
  it("disables the status select so a demo visitor cannot change a status", () => {
    render(<LeadsTable leads={SAMPLE_LEADS} demo />);
    expect(screen.getByText("Grace Liu")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Status for Grace Liu")
    ).toBeDisabled();
  });

  it("shows the demo popover on the disabled select, on hover and on focus", () => {
    render(<LeadsTable leads={SAMPLE_LEADS} demo />);
    const select = screen.getByLabelText("Status for Grace Liu");
    // The popover is linked to its select by aria-describedby.
    const tip = document.getElementById(
      select.getAttribute("aria-describedby")!
    )!;
    expect(tip).toHaveTextContent(DEMO_POPOVER_TITLE);
    expect(tip).not.toHaveClass("demo-popover-visible");
    fireEvent.mouseOver(select.parentElement!);
    expect(tip).toHaveClass("demo-popover-visible");
    fireEvent.mouseOut(select.parentElement!);
    expect(tip).not.toHaveClass("demo-popover-visible");
    fireEvent.focus(select.parentElement!);
    expect(tip).toHaveClass("demo-popover-visible");
  });

  it("leaves the status select enabled outside demo mode", () => {
    render(<LeadsTable leads={SAMPLE_LEADS} />);
    expect(
      screen.getByLabelText("Status for Grace Liu")
    ).not.toBeDisabled();
  });

  it("renders no popover at all outside demo mode", () => {
    render(<LeadsTable leads={SAMPLE_LEADS} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

function setPrefersDark(dark: boolean) {
  window.matchMedia = (query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  setPrefersDark(false);
});

function openMenu() {
  const button = screen.getByRole("button", { name: "Open menu" });
  fireEvent.click(button);
  return button;
}

const staffUser: MenuUser = {
  initials: "MC",
  name: "Maya Chen",
  email: "maya@example.com",
  role: "staff",
};

describe("HamburgerMenu in demo mode", () => {
  it("signed out: shows a Test Admin Mode entry under the sign-in rows", () => {
    render(<HamburgerMenu user={null} />);
    openMenu();
    const entry = screen.getByRole("link", {
      name: "*Test Admin Mode*",
    });
    expect(entry).toHaveAttribute("href", "/api/demo?on=1");
    // The sign-in rows are still there above it.
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.getByRole("link", { name: "Customer sign in" })
    ).toHaveAttribute("href", "/my-account/sign-in");
    // No owner links yet — demo mode is not on.
    expect(
      screen.queryByRole("link", { name: "Dashboard" })
    ).not.toBeInTheDocument();
  });

  it("demo on: shows the demo identity, an exit row, and the owner links", () => {
    render(<HamburgerMenu user={null} demo />);
    openMenu();
    expect(screen.getByText("Test Admin Mode")).toBeInTheDocument();
    expect(
      screen.getByText("Sample data — no real account")
    ).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Exit Test Admin Mode" })
    ).toHaveAttribute("href", "/api/demo?on=0");
    // The entry link is gone — demo mode is already on.
    expect(
      screen.queryByRole("link", {
        name: "*Test Admin Mode*",
      })
    ).not.toBeInTheDocument();
    // Sign in is still offered (a recruiter can sign in for real).
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
    for (const name of [
      "Dashboard",
      "Leads",
      "Customers",
      "Appointments",
      "Employees",
      "Orders",
      "Admin",
    ]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("signed out: the Test Admin Mode entry shows the demo popover on hover and focus", () => {
    render(<HamburgerMenu user={null} />);
    openMenu();
    const entry = screen.getByRole("link", {
      name: "*Test Admin Mode*",
    });
    const tip = document.getElementById(
      entry.getAttribute("aria-describedby")!
    )!;
    expect(tip).toHaveTextContent(DEMO_POPOVER_TITLE);
    expect(tip).toHaveTextContent(DEMO_POPOVER_DETAIL);
    expect(tip).not.toHaveClass("demo-popover-visible");
    fireEvent.mouseOver(entry.parentElement!);
    expect(tip).toHaveClass("demo-popover-visible");
    fireEvent.mouseOut(entry.parentElement!);
    expect(tip).not.toHaveClass("demo-popover-visible");
    // Tabbing to the link itself (the entry is a working link, so it
    // is the tab stop) shows the popover too.
    fireEvent.focus(entry);
    expect(tip).toHaveClass("demo-popover-visible");
  });

  it("demo is inert for a signed-in user: the staff menu is unchanged", () => {
    render(<HamburgerMenu user={staffUser} demo />);
    openMenu();
    expect(screen.getByText("Maya Chen")).toBeInTheDocument();
    expect(screen.queryByText("Test Admin Mode")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Exit Test Admin Mode" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("signed in: no demo popover anywhere in the menu", () => {
    render(<HamburgerMenu user={staffUser} demo />);
    openMenu();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("DemoPopover", () => {
  function renderDisabledButton() {
    render(
      <DemoPopover>
        <button type="button" disabled>
          Do it
        </button>
      </DemoPopover>
    );
    const button = screen.getByRole("button", { name: "Do it" });
    const wrapper = button.parentElement!;
    const tip = screen.getByRole("tooltip");
    return { button, wrapper, tip };
  }

  it("shows the exact demo text, hidden until hover or focus", () => {
    const { tip } = renderDisabledButton();
    expect(tip).toHaveTextContent(DEMO_POPOVER_TITLE);
    expect(tip).toHaveTextContent(DEMO_POPOVER_DETAIL);
    expect(tip).not.toHaveClass("demo-popover-visible");
  });

  it("appears on hover and hides when the mouse leaves", () => {
    const { wrapper, tip } = renderDisabledButton();
    fireEvent.mouseOver(wrapper);
    expect(tip).toHaveClass("demo-popover-visible");
    fireEvent.mouseOut(wrapper);
    expect(tip).not.toHaveClass("demo-popover-visible");
  });

  it("appears on keyboard focus, hides on blur and on Escape", () => {
    const { wrapper, tip } = renderDisabledButton();
    fireEvent.focus(wrapper);
    expect(tip).toHaveClass("demo-popover-visible");
    fireEvent.keyDown(wrapper, { key: "Escape" });
    expect(tip).not.toHaveClass("demo-popover-visible");
    fireEvent.focus(wrapper);
    expect(tip).toHaveClass("demo-popover-visible");
    fireEvent.blur(wrapper);
    expect(tip).not.toHaveClass("demo-popover-visible");
  });

  it("links the popover to the wrapped control for screen readers", () => {
    const { button, wrapper, tip } = renderDisabledButton();
    expect(button).toHaveAttribute("aria-describedby", tip.id);
    expect(tip).toHaveAttribute("role", "tooltip");
    // The wrapper is the tab stop when the control is disabled, and
    // it carries the same description.
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(wrapper).toHaveAttribute("aria-describedby", tip.id);
  });

  it("renders nothing extra when disabled: no tooltip, children unwrapped", () => {
    render(
      <DemoPopover enabled={false}>
        <button type="button">Do it</button>
      </DemoPopover>
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do it" })).toBeInTheDocument();
  });
});

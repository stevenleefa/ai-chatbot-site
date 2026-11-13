// components/HamburgerMenu.tsx — the hamburger menu at the far right of
// the fixed header. Tests the behaviour only: what the panel shows
// signed out vs signed in (staff vs admin), and that Escape closes
// it and returns focus to the button. The sign-out dialog is NOT
// exercised here: jsdom does not implement <dialog> showModal,
// and the dialog itself is covered by its own component's
// behaviour (components/SignOutButton.tsx).
import { render, screen, fireEvent } from "@testing-library/react";
import HamburgerMenu, { type MenuUser } from "@/components/HamburgerMenu";

const staffUser: MenuUser = {
  initials: "MC",
  name: "Maya Chen",
  email: "maya@example.com",
  role: "staff",
};
const adminUser: MenuUser = { ...staffUser, role: "admin" };
const customerUser: MenuUser = {
  initials: "AR",
  name: "Alex Rivera",
  email: "alex@example.com",
  role: "customer",
};

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

describe("HamburgerMenu", () => {
  it("signed out: shows a Sign in link and no account or owner rows", () => {
    render(<HamburgerMenu user={null} />);
    const button = openMenu();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.queryByRole("link", { name: "Profile" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Switch user" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log out" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Dashboard" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Contact us" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Locations" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deals" })).toBeInTheDocument();
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
  });

  it("signed in as staff: shows the user header, account rows and owner links, but no Admin", () => {
    render(<HamburgerMenu user={staffUser} />);
    openMenu();
    expect(screen.getByText("Maya Chen")).toBeInTheDocument();
    expect(screen.getByText("maya@example.com")).toBeInTheDocument();
    expect(screen.getByText("Staff")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(
      screen.getByRole("button", { name: "Switch user" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log out" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Appointments" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Employees" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orders" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Admin" })
    ).not.toBeInTheDocument();
  });

  it("signed in as admin: shows the Admin link too", () => {
    render(<HamburgerMenu user={adminUser} />);
    openMenu();
    // (The role label also reads "Admin", so the link is asserted
    // by href rather than by its text alone.)
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });

  it("signed out: shows a Customer sign in link too", () => {
    render(<HamburgerMenu user={null} />);
    openMenu();
    expect(
      screen.getByRole("link", { name: "Customer sign in" })
    ).toHaveAttribute("href", "/my-account/sign-in");
  });

  it("signed in as customer: shows My account and Log out, but no owner links, no Profile, no Switch user", () => {
    render(<HamburgerMenu user={customerUser} />);
    openMenu();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "My account" })
    ).toHaveAttribute("href", "/my-account");
    expect(
      screen.getByRole("button", { name: "Log out" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Profile" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Switch user" })
    ).not.toBeInTheDocument();
    for (const name of [
      "Dashboard",
      "Leads",
      "Customers",
      "Appointments",
      "Employees",
      "Orders",
      "Admin",
    ]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    // The public links are still there for customers.
    expect(screen.getByRole("link", { name: "Contact us" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deals" })).toBeInTheDocument();
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
  });

  it("Escape closes the panel and returns focus to the button", () => {
    render(<HamburgerMenu user={staffUser} />);
    const button = openMenu();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("link", { name: "Profile" })
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("the menu button shows a three-bar icon", () => {
    render(<HamburgerMenu user={null} />);
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("clicking outside closes the panel", () => {
    render(<HamburgerMenu user={null} />);
    openMenu();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole("link", { name: "Sign in" })
    ).not.toBeInTheDocument();
  });
});

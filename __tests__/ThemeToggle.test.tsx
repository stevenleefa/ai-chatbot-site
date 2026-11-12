// components/ThemeToggle.tsx — the light/dark switch in the fixed
// top nav. Tests the behaviour only: it flips <html data-theme>,
// persists the choice in localStorage ("lumen-theme"), and with no
// saved choice follows prefers-color-scheme. The toggle's code and
// the pre-paint script in app/layout.tsx are NOT changed here.
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeToggle from "@/components/ThemeToggle";

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

describe("ThemeToggle", () => {
  it("defaults to light when nothing is saved and the system prefers light", () => {
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    const btn = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("follows prefers-color-scheme: dark when nothing is saved", () => {
    setPrefersDark(true);
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("starts dark when localStorage has a saved dark choice (beats the system)", () => {
    window.localStorage.setItem("lumen-theme", "dark");
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("clicking flips the theme and persists the choice", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: "Switch to dark mode" });

    fireEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("lumen-theme")).toBe("dark");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAccessibleName("Switch to light mode");

    fireEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("lumen-theme")).toBe("light");
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });
});

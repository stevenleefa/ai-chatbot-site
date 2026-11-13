// components/HeaderColorSwitcher.tsx — the temporary header-colour
// switcher in the fixed top nav. Tests the behaviour only: it sets
// <html data-header>, persists the choice in localStorage
// ("lumen-header"), and defaults to plum when nothing is saved. The
// switcher's code and the pre-paint script in app/layout.tsx are NOT
// changed here.
import { render, screen, fireEvent } from "@testing-library/react";
import HeaderColorSwitcher from "@/components/HeaderColorSwitcher";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-header");
});

describe("HeaderColorSwitcher", () => {
  it("defaults to plum when nothing is saved", () => {
    render(<HeaderColorSwitcher />);
    expect(document.documentElement.getAttribute("data-header")).toBe("plum");
    expect(screen.getByRole("button", { name: "Plum header" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Rose header" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Gold header" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("starts from the saved choice", () => {
    window.localStorage.setItem("lumen-header", "gold");
    render(<HeaderColorSwitcher />);
    expect(document.documentElement.getAttribute("data-header")).toBe("gold");
    expect(screen.getByRole("button", { name: "Gold header" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("ignores a saved value that is not a header colour and falls back to plum", () => {
    window.localStorage.setItem("lumen-header", "teal");
    render(<HeaderColorSwitcher />);
    expect(document.documentElement.getAttribute("data-header")).toBe("plum");
  });

  it("clicking a swatch sets the attribute, persists the choice and moves the pressed state", () => {
    render(<HeaderColorSwitcher />);
    const rose = screen.getByRole("button", { name: "Rose header" });
    const gold = screen.getByRole("button", { name: "Gold header" });

    fireEvent.click(rose);
    expect(document.documentElement.getAttribute("data-header")).toBe("rose");
    expect(window.localStorage.getItem("lumen-header")).toBe("rose");
    expect(rose).toHaveAttribute("aria-pressed", "true");
    expect(gold).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(gold);
    expect(document.documentElement.getAttribute("data-header")).toBe("gold");
    expect(window.localStorage.getItem("lumen-header")).toBe("gold");
    expect(gold).toHaveAttribute("aria-pressed", "true");
    expect(rose).toHaveAttribute("aria-pressed", "false");
  });
});

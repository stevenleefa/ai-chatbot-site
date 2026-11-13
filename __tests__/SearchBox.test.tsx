// components/SearchBox.tsx — the compact search in the fixed
// header. Tests the behaviour only: filtering services and
// products by substring, the "No results" state, and closing on
// Escape and on a click outside.
import { render, screen, fireEvent } from "@testing-library/react";
import SearchBox, { type SearchItem } from "@/components/SearchBox";

const items: SearchItem[] = [
  { label: "Haircut — $35", href: "/#services" },
  { label: "Balayage — from $110", href: "/#services" },
  { label: "Shampoo (1L) — $24.00", href: "/products" },
  { label: "Beard oil — $14.00", href: "/products" },
];

function typeQuery(query: string) {
  const input = screen.getByRole("combobox", {
    name: "Search services and products",
  });
  fireEvent.change(input, { target: { value: query } });
  return input;
}

describe("SearchBox", () => {
  it("shows matching services and products as links", () => {
    render(<SearchBox items={items} />);
    const input = typeQuery("shampoo");
    expect(
      screen.getByRole("link", { name: "Shampoo (1L) — $24.00" })
    ).toHaveAttribute("href", "/products");
    expect(
      screen.queryByRole("link", { name: "Haircut — $35" })
    ).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "hair" } });
    expect(screen.getByRole("link", { name: "Haircut — $35" })).toHaveAttribute(
      "href",
      "/#services"
    );
    expect(
      screen.queryByRole("link", { name: "Beard oil — $14.00" })
    ).not.toBeInTheDocument();
  });

  it("matches case-insensitively", () => {
    render(<SearchBox items={items} />);
    typeQuery("BALAYAGE");
    expect(
      screen.getByRole("link", { name: "Balayage — from $110" })
    ).toBeInTheDocument();
  });

  it("shows a No results state when nothing matches", () => {
    render(<SearchBox items={items} />);
    typeQuery("zzz");
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
    expect(screen.getByText(/zzz/)).toBeInTheDocument();
  });

  it("shows nothing until the user types", () => {
    render(<SearchBox items={items} />);
    expect(
      screen.queryByRole("link", { name: "Haircut — $35" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
  });

  it("Escape closes the dropdown", () => {
    render(<SearchBox items={items} />);
    const input = typeQuery("hair");
    expect(
      screen.getByRole("link", { name: "Haircut — $35" })
    ).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(
      screen.queryByRole("link", { name: "Haircut — $35" })
    ).not.toBeInTheDocument();
  });

  it("clicking outside closes the dropdown", () => {
    render(<SearchBox items={items} />);
    typeQuery("hair");
    expect(
      screen.getByRole("link", { name: "Haircut — $35" })
    ).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole("link", { name: "Haircut — $35" })
    ).not.toBeInTheDocument();
  });
});

// components/FavoriteProducts.tsx — the Favorite products
// section on /settings. Lists favorites with photo/price/Remove,
// adds from a dropdown of the products not yet favorited, and says
// so (instead of erroring) when favorites are not set up yet.
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FavoriteProducts from "@/components/FavoriteProducts";
import { PRODUCTS } from "@/lib/products";

// The row layout lives in a dedicated stylesheet (jsdom does not
// apply it), so the layout tests assert on the stylesheet itself
// as well as on the rendered structure — if a rule is removed the
// test fails instead of silently reintroducing the bullet, the
// overlap, or a left-aligned button.
function favoriteCss(): string {
  return readFileSync(
    join(__dirname, "../components/FavoriteProducts.css"),
    "utf8",
  );
}

// True when the rule block for `selector` contains `declaration`
// (whitespace-insensitive).
function ruleHas(css: string, selector: string, declaration: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) return false;
  const block = match[1].replace(/\s+/g, " ");
  return block.includes(declaration);
}

function mockFetch(responses: Record<string, unknown>[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const queue = [...responses];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const body = queue.shift() ?? {};
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => body,
    } as unknown as Response);
  }) as jest.Mock;
  return calls;
}

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("FavoriteProducts", () => {
  it("lists the favorites with price and a Remove button", async () => {
    mockFetch([{ configured: true, favorites: ["shampoo-1l"] }]);
    render(<FavoriteProducts products={PRODUCTS} />);
    expect(await screen.findByText("Shampoo (1L)")).toBeInTheDocument();
    // Shampoo (1L) is buy 2 get 1 free — the unit price is $24.00.
    expect(screen.getByText(/\$24\.00/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove" }),
    ).toBeInTheDocument();
  });

  it("removes a favorite and the row disappears", async () => {
    const calls = mockFetch([
      { configured: true, favorites: ["shampoo-1l"] },
      { ok: true, favorites: [] },
    ]);
    render(<FavoriteProducts products={PRODUCTS} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(screen.queryByText("Shampoo (1L)")).not.toBeInTheDocument(),
    );
    expect(calls[1].url).toBe("/api/favorites");
    expect(calls[1].init?.method).toBe("DELETE");
    expect(calls[1].init?.body).toBe(
      JSON.stringify({ productId: "shampoo-1l" }),
    );
    expect(screen.getByText(/No favorite products yet/)).toBeInTheDocument();
  });

  it("adds a favorite from the dropdown of not-yet-favorited products", async () => {
    const calls = mockFetch([
      { configured: true, favorites: [] },
      { ok: true, favorites: ["conditioner-1l"] },
    ]);
    render(<FavoriteProducts products={PRODUCTS} />);
    expect(await screen.findByText(/No favorite products yet/)).toBeInTheDocument();
    const select = screen.getByLabelText(
      "Add a favorite product",
    ) as HTMLSelectElement;
    // The dropdown lists the shop range (not yet favorited).
    expect(
      screen.getByRole("option", { name: /Conditioner \(1L\)/ }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "conditioner-1l" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Add to favorites" }),
    );
    expect(await screen.findByText("Conditioner (1L)")).toBeInTheDocument();
    expect(calls[1].url).toBe("/api/favorites");
    expect(calls[1].init?.method).toBe("POST");
    expect(calls[1].init?.body).toBe(
      JSON.stringify({ productId: "conditioner-1l" }),
    );
  });

  it("says favorites are not set up yet when Supabase is unconfigured", async () => {
    mockFetch([{ configured: false, favorites: [] }]);
    render(<FavoriteProducts products={PRODUCTS} />);
    expect(
      await screen.findByText(/aren't set up yet/),
    ).toBeInTheDocument();
  });

  it("drops a favorite whose product is no longer in the catalogue", async () => {
    mockFetch([
      { configured: true, favorites: ["shampoo-1l", "gone-product"] },
    ]);
    render(<FavoriteProducts products={PRODUCTS} />);
    expect(await screen.findByText("Shampoo (1L)")).toBeInTheDocument();
    expect(screen.queryByText("gone-product")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("renders the favorites list with no bullet marker in front of the picture", async () => {
    mockFetch([{ configured: true, favorites: ["shampoo-1l"] }]);
    const { container } = render(<FavoriteProducts products={PRODUCTS} />);
    await screen.findByText("Shampoo (1L)");
    const list = container.querySelector("ul.favorite-list");
    expect(list).toBeInTheDocument();
    // A plain <ul> renders a disc marker in front of each item,
    // which put a bullet in front of the product picture.
    expect(ruleHas(favoriteCss(), ".favorite-list", "list-style: none")).toBe(
      true,
    );
    expect(ruleHas(favoriteCss(), ".favorite-list", "padding: 0")).toBe(true);
  });

  it("lays each favorite out as a row the Remove button cannot overlap", async () => {
    mockFetch([{ configured: true, favorites: ["shampoo-1l"] }]);
    const { container } = render(<FavoriteProducts products={PRODUCTS} />);
    await screen.findByText("Shampoo (1L)");
    const item = container.querySelector("li.favorite-item");
    expect(item).toBeInTheDocument();
    // Image, name + price, Remove — three separate elements, in
    // that order, the button last.
    const children = Array.from(item?.children ?? []);
    expect(children).toHaveLength(3);
    expect(children[0].tagName).toBe("IMG");
    expect(children[1]).toHaveClass("favorite-text");
    expect(children[2]).toHaveClass("favorite-remove");
    expect(children[2].tagName).toBe("BUTTON");
    // The row is a flex row: the text block may shrink and wrap,
    // the button never shrinks, and the button is a normal flex
    // item (never absolutely positioned over the price).
    const css = favoriteCss();
    expect(ruleHas(css, ".favorite-item", "display: flex")).toBe(true);
    expect(ruleHas(css, ".favorite-text", "min-width: 0")).toBe(true);
    expect(ruleHas(css, ".favorite-remove", "flex-shrink: 0")).toBe(true);
    expect(ruleHas(css, ".favorite-remove", "position: absolute")).toBe(false);
  });

  it("right-aligns the Remove buttons", async () => {
    mockFetch([
      {
        configured: true,
        favorites: ["shampoo-1l", "conditioner-1l"],
      },
    ]);
    render(<FavoriteProducts products={PRODUCTS} />);
    await screen.findByText("Shampoo (1L)");
    expect(screen.getByText("Conditioner (1L)")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Remove" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveClass("favorite-remove");
    }
    expect(ruleHas(favoriteCss(), ".favorite-remove", "margin-left: auto")).toBe(
      true,
    );
  });

  it("keeps the longest product name and price clear of the Remove button", async () => {
    // "Colour care gift set" is the longest name in the catalogue
    // ($56.00) — the product from the reported screenshot.
    mockFetch([{ configured: true, favorites: ["colour-care-gift-set"] }]);
    const { container } = render(<FavoriteProducts products={PRODUCTS} />);
    expect(await screen.findByText("Colour care gift set")).toBeInTheDocument();
    expect(screen.getByText(/\$56\.00/)).toBeInTheDocument();
    const item = container.querySelector("li.favorite-item");
    expect(item).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Remove" });
    expect(item).toContainElement(button);
    // The price lives in the text block, the button is a separate
    // flex item after it — never on top of it.
    const text = container.querySelector(".favorite-text");
    expect(text).toBeInTheDocument();
    expect(text?.textContent).toMatch(/\$56\.00/);
    expect(button).not.toBe(text);
  });
});

// components/FavoriteProducts.tsx — the Favorite products
// section on /settings. Lists favorites with photo/price/Remove,
// adds from a dropdown of the products not yet favorited, and says
// so (instead of erroring) when favorites are not set up yet.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FavoriteProducts from "@/components/FavoriteProducts";
import { PRODUCTS } from "@/lib/products";

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
});

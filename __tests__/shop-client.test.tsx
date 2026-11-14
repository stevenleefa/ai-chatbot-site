// components/ShopClient.tsx — featured, out-of-stock and sale
// rendering, and the cart's discounted totals. Uses the real static
// catalogue (PRODUCTS): Colour-care mask is the one featured
// product, Scalp scrub + Hair oil are out of stock, Colour-care
// shampoo is 15% off and Shampoo (1L) is buy 2 get 1 free.
import { render, screen, fireEvent, within } from "@testing-library/react";
import ShopClient from "@/components/ShopClient";
import { PRODUCTS, CART_STORAGE_KEY } from "@/lib/products";

function cardFor(productName: string) {
  // The featured product appears twice (featured section + grid);
  // the grid card is the last one with that name.
  const headings = screen.getAllByText(productName);
  const cards = headings.map((h) => h.closest("article")!);
  return cards[cards.length - 1];
}

function addToCart(productName: string, qty?: string) {
  const card = cardFor(productName);
  if (qty !== undefined) {
    const input = within(card).getByRole("spinbutton");
    fireEvent.change(input, { target: { value: qty } });
  }
  fireEvent.click(
    within(card).getByRole("button", { name: "Add to cart" })
  );
}

beforeEach(() => {
  window.localStorage.clear();
  jest.useRealTimers();
});

describe("featured", () => {
  it("shows a Featured section with a proper heading above the grid", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    expect(
      screen.getByRole("heading", { name: "Featured", level: 2 })
    ).toBeInTheDocument();
    const section = screen
      .getByRole("heading", { name: "Featured", level: 2 })
      .closest("section");
    expect(section).toHaveClass("featured-section");
    expect(within(section!).getByText("Colour-care mask")).toBeInTheDocument();
    expect(within(section!).getByText("$32.00")).toBeInTheDocument();
  });

  it("badges the featured product in the grid too", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    // Section heading + one "Featured" badge on each of the two
    // cards for the product (featured section + grid).
    expect(screen.getAllByText("Featured")).toHaveLength(3);
    expect(
      screen.getAllByText("Featured").filter((el) => el.tagName === "SPAN")
    ).toHaveLength(2);
  });

  it("renders no featured section when nothing is featured", () => {
    const plain = PRODUCTS.map((p) => ({ ...p, featured: false }));
    render(<ShopClient products={plain} checkoutEnabled={false} />);
    expect(
      screen.queryByRole("heading", { name: "Featured", level: 2 })
    ).not.toBeInTheDocument();
  });
});

describe("out of stock", () => {
  it("badges out-of-stock products and disables their quantity picker and Add button", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    for (const name of ["Hair oil", "Scalp scrub"]) {
      const card = cardFor(name);
      expect(within(card).getByText("Out of stock")).toBeInTheDocument();
      expect(
        within(card).getByText(/Out of stock — check back soon/)
      ).toBeInTheDocument();
      expect(within(card).getByRole("spinbutton")).toBeDisabled();
      expect(
        within(card).getByRole("button", { name: "Add to cart" })
      ).toBeDisabled();
    }
    // In-stock products stay buyable.
    const beardOil = cardFor("Beard oil");
    expect(
      within(beardOil).getByRole("button", { name: "Add to cart" })
    ).toBeEnabled();
  });

  it("drops saved cart lines for products that are now out of stock (and keeps the rest)", () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ "hair-oil": 1, "beard-oil": 2 })
    );
    const { container } = render(
      <ShopClient products={PRODUCTS} checkoutEnabled={false} />
    );
    const lines = container.querySelectorAll(".cart-lines li");
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toContain("Beard oil");
    // Cart line total + cart total both read $28.00 (2 × $14) —
    // scoped to the cart section, because the Colour-care shampoo
    // card's struck-through original is also $28.00.
    const cartSection = screen.getByRole("region", { name: "Your cart" });
    expect(within(cartSection).getAllByText("$28.00")).toHaveLength(2);
  });

  it("drops saved cart lines for unknown ids", () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ "no-such-product": 1, "beard-oil": 1 })
    );
    const { container } = render(
      <ShopClient products={PRODUCTS} checkoutEnabled={false} />
    );
    expect(container.querySelectorAll(".cart-lines li")).toHaveLength(1);
  });
});

describe("sales in the shop and cart", () => {
  it("shows the sale price next to the struck-through original for a percent-off product", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    const card = cardFor("Colour-care shampoo");
    expect(within(card).getByText("$23.80")).toBeInTheDocument();
    const struck = card.querySelector("s.price-original");
    expect(struck).not.toBeNull();
    expect(struck!.textContent).toBe("$28.00");
    // The offer text appears twice in the card: the aria-hidden
    // ribbon and the plain-text label next to the price.
    expect(within(card).getAllByText("15% off")).toHaveLength(2);
    // The ribbon is decorative (aria-hidden) — the offer is also
    // plain text next to the price, so it is announced once.
    const ribbon = card.querySelector(".sale-ribbon");
    expect(ribbon).not.toBeNull();
    expect(ribbon!.getAttribute("aria-hidden")).toBe("true");
    expect(ribbon!.textContent).toBe("15% off");
  });

  it("shows the offer text (but no struck-through price) for buy 2 get 1 free", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    const card = cardFor("Shampoo (1L)");
    expect(within(card).getByText("$24.00")).toBeInTheDocument();
    expect(card.querySelector("s.price-original")).toBeNull();
    expect(within(card).getAllByText("Buy 2 get 1 free")).toHaveLength(2); // ribbon + plain-text label
    expect(card.querySelector(".sale-ribbon")!.textContent).toBe(
      "Buy 2 get 1 free"
    );
  });

  it("charges the sale unit price in the cart: 3 × Colour-care shampoo = $71.40", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    addToCart("Colour-care shampoo", "3");
    // Cart line total + cart total.
    expect(screen.getAllByText("$71.40")).toHaveLength(2);
  });

  it("buy 2 get 1 free in the cart: qty 3 charges 2 ($48.00) and says 1 free", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    addToCart("Shampoo (1L)", "3");
    expect(screen.getByText(/Buy 2 get 1 free — 1 free/)).toBeInTheDocument();
    expect(screen.getAllByText("$48.00")).toHaveLength(2);
  });

  it("buy 2 get 1 free in the cart: qty 4 charges 3 ($72.00)", () => {
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    addToCart("Shampoo (1L)", "4");
    expect(screen.getAllByText("$72.00")).toHaveLength(2);
  });
});

describe("favorite hearts", () => {
  function mockFetchQueue(responses: { status: number; body: unknown }[]) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const queue = [...responses];
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift() ?? { status: 200, body: {} };
      return Promise.resolve({
        ok: next.status >= 200 && next.status < 300,
        status: next.status,
        json: async () => next.body,
      } as unknown as Response);
    }) as jest.Mock;
    return calls;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows a filled heart for a favorited product and removes it on click", async () => {
    const calls = mockFetchQueue([
      { status: 200, body: { configured: true, favorites: ["shampoo-1l"] } },
      { status: 200, body: { ok: true, favorites: [] } },
    ]);
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    const heart = await screen.findByRole("button", {
      name: "Remove Shampoo (1L) from favorites",
    });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(heart);
    expect(
      await screen.findByRole("button", {
        name: "Add Shampoo (1L) to favorites",
      }),
    ).toBeInTheDocument();
    expect(calls[1].url).toBe("/api/favorites");
    expect(calls[1].init?.method).toBe("DELETE");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Removed Shampoo (1L) from your favorites.",
    );
  });

  it("adds a favorite on click when signed in", async () => {
    const calls = mockFetchQueue([
      { status: 200, body: { configured: true, favorites: [] } },
      { status: 200, body: { ok: true, favorites: ["beard-oil"] } },
    ]);
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add Beard oil to favorites",
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Remove Beard oil from favorites",
      }),
    ).toBeInTheDocument();
    expect(calls[1].init?.method).toBe("POST");
    expect(calls[1].init?.body).toBe(
      JSON.stringify({ productId: "beard-oil" }),
    );
  });

  it("signed out: tapping a heart prompts to sign in instead of failing silently", async () => {
    mockFetchQueue([{ status: 401, body: { error: "Sign in required." } }]);
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add Beard oil to favorites",
      }),
    );
    const prompt = await screen.findByText(/Sign in to save favorites/);
    expect(prompt).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Customer sign in" }),
    ).toHaveAttribute("href", "/my-account/sign-in");
    // No write was attempted.
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(
        ([, init]: [string, RequestInit | undefined]) =>
          init?.method === "POST" || init?.method === "DELETE",
      ),
    ).toHaveLength(0);
  });
});

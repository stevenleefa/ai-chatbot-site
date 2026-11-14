// Wave 3 client pieces: the referral copy button, Buy again /
// bundle adds to the localStorage cart, the Saved carts local
// fallback (restore replaces with confirm, delete removes), and
// the shop's Save cart control falling back to this device when
// the API answers 401 (signed out).
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import ReferralCard from "@/components/ReferralCard";
import RepurchaseSection from "@/components/RepurchaseSection";
import SavedCartsSection from "@/components/SavedCartsSection";
import ShopClient from "@/components/ShopClient";
import { PRODUCTS, CART_STORAGE_KEY, getProduct } from "@/lib/products";
import {
  LOCAL_SAVED_CARTS_KEY,
} from "@/lib/saved-carts-client";

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("ReferralCard", () => {
  it("shows the credit with a booking link, and copies the link", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <ReferralCard
        code="abc12345"
        link="https://ai-chatbot-site-tawny.vercel.app/?ref=abc12345"
        hasCredit
        usedCount={0}
      />
    );
    expect(screen.getByText("You have 50% off your next haircut.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Book your discounted haircut" })
    ).toHaveAttribute("href", "/#booking");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://ai-chatbot-site-tawny.vercel.app/?ref=abc12345"
      )
    );
    expect(await screen.findByText(/Copied/)).toBeInTheDocument();
  });

  it("says a used credit was used, instead of showing no credit", () => {
    render(
      <ReferralCard code="abc12345" link="https://example.com/?ref=abc12345" hasCredit={false} usedCount={1} />
    );
    expect(screen.getByText(/already used your 50% off/)).toBeInTheDocument();
    expect(screen.queryByText(/You have 50% off/)).not.toBeInTheDocument();
  });
});

describe("RepurchaseSection", () => {
  const shampoo = getProduct("shampoo-1l")!;
  const hairOil = getProduct("hair-oil")!; // out of stock
  const bundle = {
    source: "curated" as const,
    title: "The starter routine",
    products: [shampoo, getProduct("conditioner-1l")!],
    skipped: ["Hair oil"],
    totalCents: 2400 + 2200,
  };

  it("Buy again adds one to the shop cart and confirms in text", () => {
    render(
      <RepurchaseSection previouslyPurchased={[shampoo, hairOil]} bundle={bundle} />
    );
    // Only the in-stock product gets a Buy again button.
    expect(screen.getAllByRole("button", { name: "Buy again" })).toHaveLength(1);
    expect(screen.getByText(/Out of stock/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buy again" }));
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({
      "shampoo-1l": 1,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added Shampoo (1L) to your cart."
    );
    expect(screen.getByRole("link", { name: "View your cart" })).toHaveAttribute(
      "href",
      "/products"
    );
  });

  it("Add bundle adds every bundle product at once and names skipped ones", () => {
    render(
      <RepurchaseSection previouslyPurchased={[]} bundle={bundle} />
    );
    expect(screen.getByText("Bundle price:")).toBeInTheDocument();
    expect(screen.getByText("$46.00")).toBeInTheDocument();
    expect(screen.getByText(/Not included: Hair oil/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add bundle to cart" }));
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({
      "shampoo-1l": 1,
      "conditioner-1l": 1,
    });
  });
});

describe("SavedCartsSection (local fallback)", () => {
  beforeEach(() => {
    window.localStorage.setItem(
      LOCAL_SAVED_CARTS_KEY,
      JSON.stringify([
        {
          name: "Monthly restock",
          items: [{ id: "shampoo-1l", quantity: 2 }],
          savedAt: "2026-11-10T10:00:00.000Z",
        },
      ])
    );
    // The API says Supabase is unconfigured, so the section uses
    // the on-device list.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false, carts: [] }),
    } as unknown as Response);
  });

  it("lists the on-device cart and restores it (replace, empty cart needs no confirm)", async () => {
    render(<SavedCartsSection />);
    expect(await screen.findByText("Monthly restock")).toBeInTheDocument();
    expect(screen.getByText(/saved on this device only/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({
      "shampoo-1l": 2,
    });
    expect(await screen.findByText(/Restored/)).toBeInTheDocument();
  });

  it("asks first when the current cart is non-empty, and does not replace on No", async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ "beard-oil": 1 })
    );
    const confirm = jest.fn(() => false);
    window.confirm = confirm;
    render(<SavedCartsSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    expect(confirm).toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({
      "beard-oil": 1,
    });
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({
      "shampoo-1l": 2,
    });
  });

  it("deletes the on-device cart", async () => {
    render(<SavedCartsSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByText("Monthly restock")).not.toBeInTheDocument()
    );
    expect(window.localStorage.getItem(LOCAL_SAVED_CARTS_KEY)).toBe("[]");
  });
});

describe("ShopClient Save cart (local fallback)", () => {
  it("saves to this device when the API answers 401, and says so", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in required." }),
    } as unknown as Response);
    render(<ShopClient products={PRODUCTS} checkoutEnabled={false} />);
    const card = screen
      .getAllByText("Shampoo (1L)")
      .map((h) => h.closest("article")!)
      .pop()!;
    fireEvent.click(within(card).getByRole("button", { name: "Add to cart" }));
    fireEvent.click(screen.getByRole("button", { name: "Save cart" }));
    expect(await screen.findByText(/on this device only/)).toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem(LOCAL_SAVED_CARTS_KEY)!
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Saved cart");
    expect(saved[0].items).toEqual([{ id: "shampoo-1l", quantity: 1 }]);
  });
});

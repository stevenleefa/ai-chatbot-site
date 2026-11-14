/**
 * @jest-environment node
 */
// app/api/checkout/route.ts — server-side sale pricing and the
// out-of-stock / inactive rejections. Stripe, Supabase, the
// catalogue lookup and the rate limiter are mocked: what is under
// test is what the route charges and rejects, not the network.
// The catalogue mock reads the real static PRODUCTS list, so the
// starting states (15% off, buy 2 get 1, Hair oil out of stock)
// are the real ones.
import { POST } from "@/app/api/checkout/route";
import { PRODUCTS, getProduct } from "@/lib/products";

const createSession = jest.fn();

jest.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) => (name === "host" ? "localhost:3000" : null),
  }),
}));

jest.mock("../lib/products-db", () => ({
  getProductById: jest.fn(async (id: string) => {
    const { PRODUCTS } = jest.requireActual("../lib/products");
    return PRODUCTS.find((p: { id: string }) => p.id === id) ?? null;
  }),
}));

jest.mock("../lib/stripe", () => ({
  getStripe: jest.fn(),
}));

jest.mock("../lib/supabase", () => ({
  isSupabaseConfigured: () => false,
  getServerSupabase: () => null,
}));

jest.mock("../lib/security", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  readCappedJson: async (req: Request) => ({
    body: await req.json().catch(() => null),
    tooLarge: false,
  }),
}));

import { getStripe } from "../lib/stripe";
import { getProductById } from "../lib/products-db";

const mockGetStripe = getStripe as jest.Mock;
const mockGetProductById = getProductById as jest.Mock;

function checkoutRequest(items: Array<{ id: string; quantity: number }>) {
  return new Request("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      name: "Test Customer",
      email: "test@example.com",
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  createSession.mockResolvedValue({
    id: "cs_test_1",
    url: "https://checkout.stripe.test/pay",
  });
  mockGetStripe.mockReturnValue({
    checkout: { sessions: { create: createSession } },
  });
});

describe("percent-off checkout", () => {
  it("charges the sale unit price: 2 × Colour-care shampoo at $23.80", async () => {
    const res = await POST(
      checkoutRequest([{ id: "colour-care-shampoo", quantity: 2 }])
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.test/pay");
    expect(createSession).toHaveBeenCalledTimes(1);
    const lineItems = createSession.mock.calls[0][0].line_items;
    expect(lineItems).toHaveLength(1);
    // 15% off $28.00 = $23.80 per unit, quantity unchanged.
    expect(lineItems[0].quantity).toBe(2);
    expect(lineItems[0].price_data.unit_amount).toBe(2380);
    expect(lineItems[0].price_data.unit_amount * lineItems[0].quantity).toBe(
      4760
    );
  });
});

describe("buy 2 get 1 free checkout", () => {
  it("qty 3 charges 2 at full price and notes 1 free", async () => {
    const res = await POST(
      checkoutRequest([{ id: "shampoo-1l", quantity: 3 }])
    );
    expect(res.status).toBe(200);
    const lineItems = createSession.mock.calls[0][0].line_items;
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].quantity).toBe(2); // paid units
    expect(lineItems[0].price_data.unit_amount).toBe(2400);
    expect(lineItems[0].price_data.product_data.description).toContain(
      "Buy 2 get 1 free — 1 free"
    );
    expect(lineItems[0].price_data.unit_amount * lineItems[0].quantity).toBe(
      4800
    );
  });

  it("qty 4 charges 3 and notes 1 free", async () => {
    const res = await POST(
      checkoutRequest([{ id: "shampoo-1l", quantity: 4 }])
    );
    expect(res.status).toBe(200);
    const lineItems = createSession.mock.calls[0][0].line_items;
    expect(lineItems[0].quantity).toBe(3);
    expect(lineItems[0].price_data.unit_amount).toBe(2400);
    expect(lineItems[0].price_data.product_data.description).toContain(
      "Buy 2 get 1 free — 1 free"
    );
    expect(lineItems[0].price_data.unit_amount * lineItems[0].quantity).toBe(
      7200
    );
  });

  it("qty 6 charges 4 and notes 2 free", async () => {
    const res = await POST(
      checkoutRequest([{ id: "shampoo-1l", quantity: 6 }])
    );
    expect(res.status).toBe(200);
    const lineItems = createSession.mock.calls[0][0].line_items;
    expect(lineItems[0].quantity).toBe(4);
    expect(lineItems[0].price_data.product_data.description).toContain(
      "Buy 2 get 1 free — 2 free"
    );
  });
});

describe("checkout rejections", () => {
  it("rejects an out-of-stock product with 400 and never calls Stripe", async () => {
    const res = await POST(
      checkoutRequest([{ id: "hair-oil", quantity: 1 }])
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/out of stock/i);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects a removed (inactive) product with 400 and never calls Stripe", async () => {
    mockGetProductById.mockImplementationOnce(async () => ({
      ...getProduct("beard-oil")!,
      active: false,
    }));
    const res = await POST(
      checkoutRequest([{ id: "beard-oil", quantity: 1 }])
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no longer available/i);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects an unknown product id with 400", async () => {
    const res = await POST(
      checkoutRequest([{ id: "no-such-product", quantity: 1 }])
    );
    expect(res.status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects a bad quantity with 400", async () => {
    const res = await POST(
      checkoutRequest([{ id: "beard-oil", quantity: 0 }])
    );
    expect(res.status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("a non-sale product still charges full price × qty", async () => {
    const res = await POST(
      checkoutRequest([{ id: "beard-oil", quantity: 3 }])
    );
    expect(res.status).toBe(200);
    const lineItems = createSession.mock.calls[0][0].line_items;
    expect(lineItems[0].quantity).toBe(3);
    expect(lineItems[0].price_data.unit_amount).toBe(1400);
    expect(PRODUCTS).toHaveLength(15); // catalogue untouched by the mocks
  });
});

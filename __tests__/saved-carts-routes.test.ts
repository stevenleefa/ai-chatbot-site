/**
 * @jest-environment node
 */
// app/api/saved-carts — GET / POST / DELETE guards and the
// unconfigured-Supabase shape ({ configured: false }) the client
// uses to fall back to on-device saves. The session, Supabase
// config, rate limiter and saved-cart helpers are mocked; the item
// validation itself is the real validateSavedCartItems, so the
// 400 cases prove the route's shape, not a mock.
import { GET, POST } from "@/app/api/saved-carts/route";
import { DELETE } from "@/app/api/saved-carts/[id]/route";

jest.mock("../lib/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("../lib/supabase", () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getServerSupabase: jest.fn(() => ({})),
}));
jest.mock("../lib/security", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  readCappedJson: async (req: Request) => ({
    body: await req.json().catch(() => null),
    tooLarge: false,
  }),
}));
jest.mock("../lib/saved-carts", () => ({
  ...jest.requireActual("../lib/saved-carts"),
  listSavedCarts: jest.fn(),
  saveCart: jest.fn(),
  deleteSavedCart: jest.fn(),
}));

import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  deleteSavedCart,
  listSavedCarts,
  saveCart,
} from "@/lib/saved-carts";

const mockGetSession = getSession as jest.Mock;
const mockConfigured = isSupabaseConfigured as jest.Mock;
const mockList = listSavedCarts as jest.Mock;
const mockSave = saveCart as jest.Mock;
const mockDelete = deleteSavedCart as jest.Mock;

const session = {
  user: { email: "alex@example.com" },
  profile: {
    id: "u1",
    email: "alex@example.com",
    role: "customer",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
};

const savedCart = {
  id: "c1",
  customer_email: "alex@example.com",
  name: "Monthly restock",
  items: [{ id: "shampoo-1l", quantity: 2 }],
  created_at: "2026-11-10T10:00:00Z",
  updated_at: "2026-11-10T10:00:00Z",
};

function request(url: string, method = "GET", body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue(session);
  mockConfigured.mockReturnValue(true);
  mockList.mockResolvedValue([savedCart]);
  mockSave.mockResolvedValue(savedCart);
  mockDelete.mockResolvedValue(true);
});

describe("GET /api/saved-carts", () => {
  it("returns 401 when not signed in", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns { configured: false } when Supabase is unconfigured", async () => {
    mockConfigured.mockReturnValue(false);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ configured: false, carts: [] });
    expect(mockList).not.toHaveBeenCalled();
  });

  it("lists the signed-in customer's carts when configured", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith("alex@example.com");
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.carts).toEqual([savedCart]);
  });
});

describe("POST /api/saved-carts", () => {
  it("returns 401 when not signed in", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(
      request("http://localhost:3000/api/saved-carts", "POST", {
        name: "Monthly restock",
        items: [{ id: "shampoo-1l", quantity: 2 }],
      })
    );
    expect(res.status).toBe(401);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 503 with configured: false when Supabase is unconfigured", async () => {
    mockConfigured.mockReturnValue(false);
    const res = await POST(
      request("http://localhost:3000/api/saved-carts", "POST", {
        name: "Monthly restock",
        items: [{ id: "shampoo-1l", quantity: 2 }],
      })
    );
    expect(res.status).toBe(503);
    expect((await res.json()).configured).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad name or bad items", async () => {
    for (const body of [
      { name: "", items: [{ id: "shampoo-1l", quantity: 1 }] },
      { name: "x".repeat(101), items: [{ id: "shampoo-1l", quantity: 1 }] },
      { name: "Ok", items: [] },
      { name: "Ok", items: [{ id: "shampoo-1l", quantity: 0 }] },
      { name: "Ok", items: [{ id: "shampoo-1l", quantity: 100 }] },
      { name: "Ok", items: "shampoo-1l" },
    ]) {
      const res = await POST(
        request("http://localhost:3000/api/saved-carts", "POST", body)
      );
      expect(res.status).toBe(400);
    }
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("saves a valid cart for the session email", async () => {
    const res = await POST(
      request("http://localhost:3000/api/saved-carts", "POST", {
        name: "Monthly restock",
        items: [{ id: "shampoo-1l", quantity: 2 }],
      })
    );
    expect(res.status).toBe(200);
    expect(mockSave).toHaveBeenCalledWith("alex@example.com", "Monthly restock", [
      { id: "shampoo-1l", quantity: 2 },
    ]);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("DELETE /api/saved-carts/[id]", () => {
  it("returns 401 when not signed in", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await DELETE(
      request("http://localhost:3000/api/saved-carts/c1", "DELETE"),
      { params: { id: "c1" } }
    );
    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when the cart is not theirs (delete returns false)", async () => {
    mockDelete.mockResolvedValue(false);
    const res = await DELETE(
      request("http://localhost:3000/api/saved-carts/c9", "DELETE"),
      { params: { id: "c9" } }
    );
    expect(res.status).toBe(404);
    expect(mockDelete).toHaveBeenCalledWith("alex@example.com", "c9");
  });

  it("deletes the customer's own cart", async () => {
    const res = await DELETE(
      request("http://localhost:3000/api/saved-carts/c1", "DELETE"),
      { params: { id: "c1" } }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

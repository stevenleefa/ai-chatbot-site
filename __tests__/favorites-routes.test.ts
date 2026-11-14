/**
 * @jest-environment node
 */
// app/api/favorites — GET / POST / DELETE guards and the
// unconfigured-Supabase shape ({ configured: false }) the client
// uses to say favorites are not set up yet. The session, Supabase
// config, rate limiter and favorites helpers are mocked; the
// product-id validation itself is the real
// isValidFavoriteProductId, so the 400 case proves the route's
// shape, not a mock.
import { GET, POST, DELETE } from "@/app/api/favorites/route";

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
jest.mock("../lib/favorites", () => ({
  ...jest.requireActual("../lib/favorites"),
  listFavoriteProductIds: jest.fn(),
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
}));

import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  addFavorite,
  listFavoriteProductIds,
  removeFavorite,
} from "@/lib/favorites";

const mockGetSession = getSession as jest.Mock;
const mockConfigured = isSupabaseConfigured as jest.Mock;
const mockList = listFavoriteProductIds as jest.Mock;
const mockAdd = addFavorite as jest.Mock;
const mockRemove = removeFavorite as jest.Mock;

const session = {
  user: { id: "user-1", email: "alex@example.com" },
  profile: {
    id: "user-1",
    email: "alex@example.com",
    role: "customer",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
};

function postRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/favorites", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue(session);
  mockConfigured.mockReturnValue(true);
  mockList.mockResolvedValue(["shampoo-1l"]);
});

describe("GET /api/favorites", () => {
  it("401 when signed out", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("answers { configured: false } when Supabase is unconfigured", async () => {
    mockConfigured.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, favorites: [] });
  });

  it("lists the signed-in user's favorite ids", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      configured: true,
      favorites: ["shampoo-1l"],
    });
    expect(mockList).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/favorites", () => {
  it("401 when signed out", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(postRequest({ productId: "shampoo-1l" }));
    expect(res.status).toBe(401);
  });

  it("400 for an unknown product id", async () => {
    const res = await POST(postRequest({ productId: "not-a-product" }));
    expect(res.status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("adds and returns the updated list", async () => {
    mockAdd.mockResolvedValue(true);
    mockList.mockResolvedValue(["shampoo-1l", "conditioner-1l"]);
    const res = await POST(postRequest({ productId: "conditioner-1l" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      favorites: ["shampoo-1l", "conditioner-1l"],
    });
    expect(mockAdd).toHaveBeenCalledWith("user-1", "conditioner-1l");
  });
});

describe("DELETE /api/favorites", () => {
  it("401 when signed out", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await DELETE(postRequest({ productId: "shampoo-1l" }, "DELETE"));
    expect(res.status).toBe(401);
  });

  it("400 for an unknown product id", async () => {
    const res = await DELETE(postRequest({ productId: "not-a-product" }, "DELETE"));
    expect(res.status).toBe(400);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("removes and returns the updated list", async () => {
    mockRemove.mockResolvedValue(true);
    mockList.mockResolvedValue([]);
    const res = await DELETE(postRequest({ productId: "shampoo-1l" }, "DELETE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, favorites: [] });
    expect(mockRemove).toHaveBeenCalledWith("user-1", "shampoo-1l");
  });
});

// lib/favorites.ts — product-id validation and the server
// helpers' safe behaviour without Supabase. The DB calls themselves
// need a live Supabase, so they are covered by the route tests
// (mocked helpers) and by the SQL run on the clone — here the
// guarantees are: unknown ids are rejected before any DB call, and
// everything degrades to [] / false when Supabase is unconfigured.
import {
  addFavorite,
  isValidFavoriteProductId,
  listFavoriteProductIds,
  removeFavorite,
} from "@/lib/favorites";

describe("isValidFavoriteProductId", () => {
  it("accepts a real catalogue id and rejects anything else", () => {
    expect(isValidFavoriteProductId("shampoo-1l")).toBe(true);
    expect(isValidFavoriteProductId("colour-care-mask")).toBe(true);
    expect(isValidFavoriteProductId("not-a-product")).toBe(false);
    expect(isValidFavoriteProductId("")).toBe(false);
    expect(isValidFavoriteProductId(null)).toBe(false);
    expect(isValidFavoriteProductId(42)).toBe(false);
  });
});

describe("server helpers without Supabase", () => {
  it("lists nothing, and add/remove fail closed", async () => {
    await expect(listFavoriteProductIds("user-1")).resolves.toEqual([]);
    await expect(addFavorite("user-1", "shampoo-1l")).resolves.toBe(false);
    await expect(removeFavorite("user-1", "shampoo-1l")).resolves.toBe(false);
  });

  it("rejects an unknown product id before any DB call", async () => {
    await expect(addFavorite("user-1", "not-a-product")).resolves.toBe(false);
    await expect(removeFavorite("user-1", "not-a-product")).resolves.toBe(
      false,
    );
  });

  it("rejects an empty user id", async () => {
    await expect(listFavoriteProductIds("")).resolves.toEqual([]);
    await expect(addFavorite("", "shampoo-1l")).resolves.toBe(false);
    await expect(removeFavorite("", "shampoo-1l")).resolves.toBe(false);
  });
});

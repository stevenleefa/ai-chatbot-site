// lib/product-validation.ts — the pure logic behind /admin/products:
// dollars-to-cents, the slug made from a product name, sale
// validation and image-URL validation. No Supabase here, so these
// tests prove the rules without a live database; the server actions
// in app/admin/products/actions.ts import the same functions, so a
// rule proven here is the rule the admin form enforces.
import {
  dollarsToCents,
  isValidImageUrl,
  parseSale,
  saleToColumns,
  slugifyProductName,
  validateProductFields,
} from "@/lib/product-validation";

describe("dollarsToCents", () => {
  it("converts whole dollars to cents", () => {
    expect(dollarsToCents("24")).toBe(2400);
    expect(dollarsToCents(24)).toBe(2400);
    expect(dollarsToCents("0")).toBe(0);
  });

  it("converts dollars and cents, rounding to the nearest cent", () => {
    expect(dollarsToCents("24.99")).toBe(2499);
    expect(dollarsToCents("19.50")).toBe(1950);
    expect(dollarsToCents("24.995")).toBe(2500);
    expect(dollarsToCents(" 14.25 ")).toBe(1425);
  });

  it("rejects empty, non-numeric and negative prices", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("   ")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("$24")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents(-1)).toBeNull();
    expect(dollarsToCents(Number.NaN)).toBeNull();
    expect(dollarsToCents(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("slugifyProductName", () => {
  it("lowercases and turns spaces into hyphens", () => {
    expect(slugifyProductName("Colour-care mask")).toBe(
      "colour-care-mask"
    );
    expect(slugifyProductName("Hair Oil")).toBe("hair-oil");
  });

  it("strips punctuation and collapses runs of separators", () => {
    expect(slugifyProductName("Shampoo (1L)")).toBe("shampoo-1l");
    expect(slugifyProductName("  Beard  Oil! ")).toBe("beard-oil");
    expect(slugifyProductName("A&B Cream")).toBe("a-b-cream");
  });

  it("returns an empty slug when the name has no letters or numbers", () => {
    expect(slugifyProductName("!!!")).toBe("");
    expect(slugifyProductName("   ")).toBe("");
  });

  it("never produces a slug that collides with a different name's slug by case alone", () => {
    // "Hair Oil" and "hair oil" make the same id — the add action
    // rejects the second one as a duplicate.
    expect(slugifyProductName("Hair Oil")).toBe(
      slugifyProductName("hair oil")
    );
  });
});

describe("isValidImageUrl", () => {
  it("accepts empty and https:// URLs", () => {
    expect(isValidImageUrl("")).toBe(true);
    expect(
      isValidImageUrl("https://images.unsplash.com/photo-123?w=800")
    ).toBe(true);
  });

  it("rejects http://, relative paths and javascript: URLs", () => {
    expect(isValidImageUrl("http://example.com/photo.jpg")).toBe(false);
    expect(isValidImageUrl("images.unsplash.com/photo-123")).toBe(false);
    expect(isValidImageUrl("/images/photo.jpg")).toBe(false);
    expect(isValidImageUrl("javascript:alert(1)")).toBe(false);
    expect(isValidImageUrl("HTTPS://example.com/photo.jpg")).toBe(false);
  });
});

describe("parseSale", () => {
  it("'none' means no sale", () => {
    expect(
      parseSale({ type: "none", percent: "", buy: "", get: "" })
    ).toBeNull();
    expect(parseSale({ type: "", percent: "", buy: "", get: "" })).toBeNull();
  });

  it("accepts a percent sale from 1 to 99", () => {
    expect(
      parseSale({ type: "percent", percent: "15", buy: "", get: "" })
    ).toEqual({ type: "percent", percent: 15 });
    expect(
      parseSale({ type: "percent", percent: "99", buy: "", get: "" })
    ).toEqual({ type: "percent", percent: 99 });
    expect(
      parseSale({ type: "percent", percent: "1", buy: "", get: "" })
    ).toEqual({ type: "percent", percent: 1 });
  });

  it("rejects percent out of range, fractional, or missing", () => {
    for (const percent of ["0", "100", "150", "15.5", "", "abc"]) {
      expect(() =>
        parseSale({ type: "percent", percent, buy: "", get: "" })
      ).toThrow("Percent off must be a whole number from 1 to 99.");
    }
  });

  it("accepts a buy X get Y free sale with positive integers", () => {
    expect(
      parseSale({ type: "buyXGetY", percent: "", buy: "2", get: "1" })
    ).toEqual({ type: "buyXGetY", buy: 2, get: 1 });
  });

  it("rejects buy/get of zero, negative, fractional, or missing", () => {
    const bad = ["0", "-1", "1.5", "", "abc"];
    for (const buy of bad) {
      expect(() =>
        parseSale({ type: "buyXGetY", percent: "", buy, get: "1" })
      ).toThrow("Buy quantity must be a whole number from 1 to 99.");
    }
    for (const get of bad) {
      expect(() =>
        parseSale({ type: "buyXGetY", percent: "", buy: "2", get })
      ).toThrow("Free quantity must be a whole number from 1 to 99.");
    }
  });

  it("rejects an unknown sale type", () => {
    expect(() =>
      parseSale({ type: "half-price", percent: "", buy: "", get: "" })
    ).toThrow("Sale type must be none, percent, or buy X get Y free.");
  });

  it("ignores the numbers for the sale type not chosen", () => {
    // A percent sale with stale buy/get numbers still parses — the
    // form leaves the unused inputs blank, and the server only ever
    // stores the chosen type's numbers.
    expect(
      parseSale({ type: "percent", percent: "15", buy: "0", get: "0" })
    ).toEqual({ type: "percent", percent: 15 });
  });
});

describe("saleToColumns", () => {
  it("maps no sale to four nulls", () => {
    expect(saleToColumns(null)).toEqual({
      sale_type: null,
      sale_percent: null,
      sale_buy: null,
      sale_get: null,
    });
  });

  it("maps a percent sale, clearing the buy/get columns", () => {
    expect(saleToColumns({ type: "percent", percent: 15 })).toEqual({
      sale_type: "percent",
      sale_percent: 15,
      sale_buy: null,
      sale_get: null,
    });
  });

  it("maps a buy X get Y sale, clearing the percent column", () => {
    expect(saleToColumns({ type: "buyXGetY", buy: 2, get: 1 })).toEqual({
      sale_type: "buyXGetY",
      sale_percent: null,
      sale_buy: 2,
      sale_get: 1,
    });
  });
});

const validFields = {
  name: "Colour-care mask",
  price: "32",
  description: "A weekly deep mask for coloured hair.",
  category: "Colour care",
  image: "https://images.unsplash.com/photo-123?w=800",
  inStock: true,
  saleType: "none",
  salePercent: "",
  saleBuy: "",
  saleGet: "",
};

describe("validateProductFields", () => {
  it("accepts a valid product and converts the price to cents", () => {
    expect(validateProductFields(validFields)).toEqual({
      name: "Colour-care mask",
      priceCents: 3200,
      description: "A weekly deep mask for coloured hair.",
      category: "Colour care",
      image: "https://images.unsplash.com/photo-123?w=800",
      inStock: true,
      sale: null,
    });
  });

  it("accepts a percent sale and a buy X get Y sale", () => {
    expect(
      validateProductFields({
        ...validFields,
        saleType: "percent",
        salePercent: "15",
      }).sale
    ).toEqual({ type: "percent", percent: 15 });
    expect(
      validateProductFields({
        ...validFields,
        saleType: "buyXGetY",
        saleBuy: "2",
        saleGet: "1",
      }).sale
    ).toEqual({ type: "buyXGetY", buy: 2, get: 1 });
  });

  it("rejects an empty name and a name over 100 characters", () => {
    expect(() =>
      validateProductFields({ ...validFields, name: "   " })
    ).toThrow("Name must be between 1 and 100 characters.");
    expect(() =>
      validateProductFields({ ...validFields, name: "x".repeat(101) })
    ).toThrow("Name must be between 1 and 100 characters.");
  });

  it("rejects a bad price", () => {
    expect(() =>
      validateProductFields({ ...validFields, price: "-3" })
    ).toThrow("Price must be a number of dollars, 0 or more.");
    expect(() =>
      validateProductFields({ ...validFields, price: "free" })
    ).toThrow("Price must be a number of dollars, 0 or more.");
  });

  it("rejects a description over 500 characters", () => {
    expect(() =>
      validateProductFields({
        ...validFields,
        description: "x".repeat(501),
      })
    ).toThrow("Description must be 500 characters or fewer.");
  });

  it("rejects an empty category and a category over 100 characters", () => {
    expect(() =>
      validateProductFields({ ...validFields, category: "" })
    ).toThrow("Category must be between 1 and 100 characters.");
    expect(() =>
      validateProductFields({
        ...validFields,
        category: "x".repeat(101),
      })
    ).toThrow("Category must be between 1 and 100 characters.");
  });

  it("rejects a non-https image URL", () => {
    expect(() =>
      validateProductFields({
        ...validFields,
        image: "http://example.com/photo.jpg",
      })
    ).toThrow("Image URL must be empty or start with https://.");
  });

  it("rejects an invalid sale", () => {
    expect(() =>
      validateProductFields({
        ...validFields,
        saleType: "percent",
        salePercent: "0",
      })
    ).toThrow("Percent off must be a whole number from 1 to 99.");
  });
});

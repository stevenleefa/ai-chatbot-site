// Product tool tests (lib/tools.ts). Prices come from
// lib/products.ts only, via the pricing helpers — a sale price is
// stated, never the pre-sale price. Out-of-stock and inactive
// products are refused, never added.
import {
  OPENAI_TOOL_DEFS,
  actionToText,
  addToCart,
  dispatchTool,
  parseProductIntent,
  recommendProduct,
  searchProducts,
  validateAddToCart,
} from "@/lib/tools";
import { getProduct } from "@/lib/products";

describe("searchProducts", () => {
  it("answers a product price question with the real sale price", () => {
    const action = searchProducts("colour-care shampoo");
    expect(action.type).toBe("products");
    if (action.type === "products") {
      expect(action.products[0].name).toBe("Colour-care shampoo");
      // 15% off $28.00 = $23.80, via getSalePriceCents.
      expect(action.products[0].salePrice).toBe("$23.80");
      expect(action.products[0].price).toBe("$28.00");
      expect(action.products[0].discount).toBe("15% off");
      expect(actionToText(action)).toContain("$23.80");
    }
  });

  it("lists a buy-2-get-1-free product at its full unit price", () => {
    const action = searchProducts("shampoo 1l");
    expect(action.type).toBe("products");
    if (action.type === "products") {
      const shampoo = action.products.find((p) => p.id === "shampoo-1l")!;
      expect(shampoo.price).toBe("$24.00");
      expect(shampoo.salePrice).toBeNull();
      expect(shampoo.discount).toBe("Buy 2 get 1 free");
    }
  });

  it("returns an empty list (not a failure) when nothing matches", () => {
    const action = searchProducts("wedding dresses");
    expect(action).toEqual(
      expect.objectContaining({ type: "products", products: [] })
    );
  });

  it("only lists active products", () => {
    const action = searchProducts("shampoo");
    expect(action.type).toBe("products");
    if (action.type === "products") {
      expect(action.products.length).toBeGreaterThan(0);
      for (const p of action.products) {
        expect(getProduct(p.id)?.active).toBe(true);
      }
    }
  });
});

describe("recommendProduct", () => {
  it("recommends the colour-care mask for coloured hair, with a reason from its description", () => {
    const action = recommendProduct("coloured hair");
    expect(action.type).toBe("product_recommendation");
    if (action.type === "product_recommendation") {
      expect(action.product.name).toBe("Colour-care mask");
      expect(action.reason).toContain("coloured hair");
      expect(actionToText(action)).toContain("Colour-care mask");
    }
  });

  it("recommends beard oil for a beard, and leave-in treatment for dry hair", () => {
    const beard = recommendProduct("my beard is rough");
    expect(beard.type).toBe("product_recommendation");
    if (beard.type === "product_recommendation") {
      expect(beard.product.name).toBe("Beard oil");
    }
    const dry = recommendProduct("dry ends");
    expect(dry.type).toBe("product_recommendation");
    if (dry.type === "product_recommendation") {
      expect(dry.product.name).toBe("Leave-in treatment");
    }
  });

  it("never recommends an out-of-stock product: the scalp scrub is out, so it names the alternative", () => {
    const action = recommendProduct("scalp care");
    expect(action.type).toBe("product_recommendation");
    if (action.type === "product_recommendation") {
      expect(action.product.name).not.toBe("Scalp scrub");
      expect(action.product.name).toBe("Shampoo (1L)");
      expect(action.reason).toContain("Scalp scrub is out of stock");
    }
  });

  it("falls back to the featured product for an unrecognised need", () => {
    const action = recommendProduct("something nice");
    expect(action.type).toBe("product_recommendation");
    if (action.type === "product_recommendation") {
      expect(action.product.name).toBe("Colour-care mask");
    }
  });
});

describe("addToCart", () => {
  it("returns the structured addToCart action for an in-stock product", () => {
    const action = addToCart({ productId: "colour-care-mask", quantity: 2 });
    expect(action).toEqual({
      type: "cart_added",
      action: "addToCart",
      productId: "colour-care-mask",
      productName: "Colour-care mask",
      quantity: 2,
      unitPrice: "$32.00",
    });
    expect(actionToText(action)).toBe(
      "Added Colour-care mask × 2 to your cart — view it on the shop page."
    );
  });

  it("resolves a product by name, and defaults the quantity to 1", () => {
    const action = addToCart({ productName: "Beard oil" });
    expect(action).toEqual(
      expect.objectContaining({
        type: "cart_added",
        productId: "beard-oil",
        quantity: 1,
      })
    );
  });

  it("refuses an out-of-stock product with a plain message, never adding it", () => {
    const action = addToCart({ productId: "hair-oil", quantity: 1 });
    expect(action.type).toBe("cart_failed");
    if (action.type === "cart_failed") {
      expect(action.reason).toContain("out of stock");
    }
    expect(actionToText(action)).toContain("out of stock");
  });

  it("refuses an unknown product and an ambiguous name", () => {
    expect(addToCart({ productId: "no-such-product" })).toEqual(
      expect.objectContaining({ type: "cart_failed" })
    );
    const ambiguous = addToCart({ productName: "shampoo" });
    expect(ambiguous.type).toBe("cart_failed");
    if (ambiguous.type === "cart_failed") {
      expect(ambiguous.reason).toContain("more than one product");
    }
  });

  it("refuses out-of-range quantities (0, 100, fractional)", () => {
    for (const quantity of [0, 100, 1.5]) {
      const action = addToCart({ productId: "beard-oil", quantity });
      expect(action.type).toBe("cart_failed");
    }
  });

  it("accepts a digit-string quantity, as a function-calling model may send one", () => {
    const action = addToCart({ productId: "beard-oil", quantity: "2" });
    expect(action).toEqual(
      expect.objectContaining({ type: "cart_added", quantity: 2 })
    );
  });
});

describe("validateAddToCart", () => {
  it("refuses an inactive product", () => {
    const inactive = { ...getProduct("beard-oil")!, active: false };
    const result = validateAddToCart(inactive, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("no longer in the shop");
  });

  it("refuses a null product", () => {
    expect(validateAddToCart(null, 1).ok).toBe(false);
  });
});

describe("dispatchTool product tools", () => {
  it("dispatches searchProducts, recommendProduct and addToCart by name", async () => {
    const searched = await dispatchTool("searchProducts", { query: "beard oil" });
    expect(searched.action.type).toBe("products");
    expect(searched.summary).toContain("$14.00");

    const recommended = await dispatchTool("recommendProduct", { need: "heat styling" });
    expect(recommended.action.type).toBe("product_recommendation");

    const added = await dispatchTool("addToCart", {
      productId: "dry-shampoo",
      quantity: 1,
    });
    expect(added.action).toEqual(
      expect.objectContaining({ type: "cart_added", action: "addToCart" })
    );
  });
});

describe("OPENAI_TOOL_DEFS", () => {
  it("exposes all six tools, including the three product tools", () => {
    const names = OPENAI_TOOL_DEFS.map((d) => d.function.name);
    expect(names).toEqual([
      "getServices",
      "getAvailability",
      "createBooking",
      "searchProducts",
      "recommendProduct",
      "addToCart",
    ]);
  });
});

describe("parseProductIntent", () => {
  it("parses an add-to-cart request with a named product and quantity", () => {
    expect(parseProductIntent("Add 2 colour-care masks to my cart")).toEqual({
      kind: "product_add",
      productId: "colour-care-mask",
      quantity: 2,
    });
    expect(parseProductIntent("Add the hair oil to my cart")).toEqual({
      kind: "product_add",
      productId: "hair-oil",
      quantity: 1,
    });
  });

  it("parses a recommendation request", () => {
    expect(
      parseProductIntent("What product do you recommend for coloured hair?")
    ).toEqual({
      kind: "product_recommend",
      need: "What product do you recommend for coloured hair?",
    });
  });

  it("parses a product price question as a search", () => {
    expect(parseProductIntent("How much is the colour-care shampoo?")).toEqual({
      kind: "product_search",
      query: "Colour-care shampoo",
    });
  });

  it("does NOT hijack service questions: beard trims stay a service question", () => {
    expect(parseProductIntent("Do you do beard trims?")).toEqual({ kind: "none" });
    expect(parseProductIntent("How much is a haircut?")).toEqual({ kind: "none" });
    expect(parseProductIntent("How much is a balayage?")).toEqual({ kind: "none" });
  });

  it("does not match ordinary questions", () => {
    expect(parseProductIntent("What are your opening hours?")).toEqual({
      kind: "none",
    });
  });
});

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  getDiscountLabel,
  getLineTotalCents,
  getSalePriceCents,
  type Product,
} from "@/lib/products";
import { getProductById } from "@/lib/products-db";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { BUSINESS_SLUG } from "@/lib/leads";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Stripe Checkout session creation. The cart arrives as product ids
// + quantities ONLY — prices are never trusted from the client: every
// line is re-priced server-side from the catalogue (Supabase when
// configured, the static list otherwise), and unknown, out-of-stock
// or removed product ids, or out-of-range quantities, are rejected
// with 400. Sales are charged at their discounted price (see SHOP.md):
// percent-off charges the sale unit price, buyXGetY charges only for
// the paid units. The card is taken on Stripe's hosted checkout page
// (the client is redirected to session.url); this site never sees
// card numbers. A pending order row is recorded for the owner list
// when Supabase is configured; the success page marks it paid only
// after Stripe confirms payment_status "paid" (see SHOP.md).
const MAX_LINES = 20;
const MAX_QTY = 99;

// Whether a sale is well-formed enough to charge. The pricing
// helpers in lib/products.ts already treat malformed sales as no
// sale; these mirrors keep the Stripe line items consistent with
// them (a percent over 100, or a buy/get that is not a positive
// integer, must never produce a negative or nonsense unit price).
function validPercentSale(product: Product): boolean {
  const sale = product.sale;
  return (
    !!sale &&
    sale.type === "percent" &&
    sale.percent > 0 &&
    sale.percent <= 100
  );
}

function validBuyXGetYSale(product: Product): boolean {
  const sale = product.sale;
  return (
    !!sale &&
    sale.type === "buyXGetY" &&
    Number.isInteger(sale.buy) &&
    Number.isInteger(sale.get) &&
    sale.buy > 0 &&
    sale.get > 0
  );
}

// The unit price Stripe is charged per paid unit: the sale price
// for a percent-off product, the full price otherwise (buyXGetY
// does not change the unit price — the free units come off the
// quantity instead).
function chargedUnitCents(product: Product): number {
  return validPercentSale(product)
    ? getSalePriceCents(product)
    : product.priceCents;
}

// How many units Stripe is charged for: the full quantity, except
// buyXGetY where only the paid units are charged (buy 2 get 1,
// qty 3 → 2 paid; qty 4 → 3 paid). The free units are noted in the
// line item's description.
function paidQuantity(product: Product, quantity: number): number {
  if (!validBuyXGetYSale(product)) return quantity;
  const sale = product.sale!;
  if (sale.type !== "buyXGetY") return quantity;
  const freeUnits =
    Math.floor(quantity / (sale.buy + sale.get)) * sale.get;
  return quantity - freeUnits;
}

export async function POST(req: Request) {
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { error: "That request is too large." },
      { status: 413 }
    );
  }

  const ip = clientIp(req);
  const limit = rateLimit(`checkout:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many checkout attempts — please wait a moment and try again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const fields =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const { items, name, email } = fields;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > 100
  ) {
    return NextResponse.json(
      { error: "Add your name (under 100 characters)." },
      { status: 400 }
    );
  }
  if (
    typeof email !== "string" ||
    email.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json(
      { error: "Add a valid email address." },
      { status: 400 }
    );
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
    return NextResponse.json(
      { error: "Add at least one product to the cart." },
      { status: 400 }
    );
  }

  // Validate each line against the catalogue and price it here.
  // Out-of-stock and removed products are rejected even though the
  // shop hides/disables them — a stale or hand-built cart must not
  // be able to buy something the studio cannot sell.
  const lines: {
    product: Product;
    quantity: number;
    paidQuantity: number;
    unitCents: number;
  }[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) {
      return NextResponse.json(
        { error: "The cart is not in the expected shape." },
        { status: 400 }
      );
    }
    const { id, quantity } = item as Record<string, unknown>;
    if (typeof id !== "string") {
      return NextResponse.json(
        { error: "Unknown product in the cart." },
        { status: 400 }
      );
    }
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json(
        { error: `Unknown product: ${id}.` },
        { status: 400 }
      );
    }
    if (!product.active) {
      return NextResponse.json(
        { error: `${product.name} is no longer available.` },
        { status: 400 }
      );
    }
    if (!product.inStock) {
      return NextResponse.json(
        { error: `${product.name} is out of stock.` },
        { status: 400 }
      );
    }
    if (
      !Number.isInteger(quantity) ||
      (quantity as number) < 1 ||
      (quantity as number) > MAX_QTY
    ) {
      return NextResponse.json(
        { error: "Quantities must be whole numbers from 1 to 99." },
        { status: 400 }
      );
    }
    const qty = quantity as number;
    lines.push({
      product,
      quantity: qty,
      paidQuantity: paidQuantity(product, qty),
      unitCents: chargedUnitCents(product),
    });
  }
  const totalCents = lines.reduce(
    (sum, l) => sum + getLineTotalCents(l.product, l.quantity),
    0
  );

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Checkout is not set up yet." },
      { status: 503 }
    );
  }

  // Origin for the success / cancel URLs: NEXT_PUBLIC_SITE_URL in
  // production, the request's Host header in dev (same pattern as
  // the invite links — see app/admin/actions.ts).
  const headerList = headers();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const host = headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = siteUrl || (host ? `${proto}://${host}` : "");
  if (!origin) {
    return NextResponse.json(
      { error: "Could not work out the site address." },
      { status: 500 }
    );
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lines.map((l) => {
        const freeUnits = l.quantity - l.paidQuantity;
        const label = getDiscountLabel(l.product);
        // BuyXGetY: charge only the paid units at full price, and
        // say how many are free. Percent-off: charge the sale unit
        // price for every unit. Either way the Stripe total is the
        // same discounted total the shopper saw in the cart.
        const description =
          freeUnits > 0 && label
            ? `${l.product.description} — ${label} — ${freeUnits} free`
            : l.product.description;
        return {
          quantity: l.paidQuantity,
          price_data: {
            currency: "usd",
            unit_amount: l.unitCents,
            product_data: {
              name: l.product.name,
              description,
            },
          },
        };
      }),
      success_url: `${origin}/products/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/products/cancelled`,
      customer_email: email.trim(),
      metadata: {
        business: BUSINESS_SLUG,
        customer_name: name.trim(),
      },
    });
  } catch (e) {
    // Never leak Stripe's error text (or keys) to the client.
    console.error(
      "Stripe Checkout session failed:",
      e instanceof Error ? e.message : "unknown error"
    );
    return NextResponse.json(
      { error: "Checkout could not start. Please try again." },
      { status: 502 }
    );
  }
  if (!session.url) {
    return NextResponse.json(
      { error: "Checkout could not start. Please try again." },
      { status: 502 }
    );
  }

  // Record the pending order for the owner list. If the write fails,
  // the checkout still goes ahead — the payment is the priority, and
  // the success page shows the Stripe confirmation either way. The
  // recorded items are what was actually charged: the discounted
  // unit price, and for buyXGetY only the paid quantity.
  if (isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { error } = await supabase!.from("orders").insert({
      business: BUSINESS_SLUG,
      customer_name: name.trim(),
      customer_email: email.trim(),
      items: lines.map((l) => ({
        id: l.product.id,
        name: l.product.name,
        price_cents: l.unitCents,
        quantity: l.paidQuantity,
      })),
      total_cents: totalCents,
      currency: "usd",
      stripe_session_id: session.id,
      status: "pending",
    });
    if (error) {
      console.error("Could not record order:", error.message);
    }
  }

  return NextResponse.json({ url: session.url });
}

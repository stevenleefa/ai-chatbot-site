import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getProduct, type Product } from "@/lib/products";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { BUSINESS_SLUG } from "@/lib/leads";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Stripe Checkout session creation. The cart arrives as product ids
// + quantities ONLY — prices are never trusted from the client: every
// line is re-priced server-side from lib/products.ts, and unknown
// product ids or out-of-range quantities are rejected with 400.
// The card is taken on Stripe's hosted checkout page (the client is
// redirected to session.url); this site never sees card numbers.
// A pending order row is recorded for the owner list when Supabase
// is configured; the success page marks it paid only after Stripe
// confirms payment_status "paid" (see SHOP.md).
const MAX_LINES = 20;
const MAX_QTY = 99;

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
  const lines: { product: Product; quantity: number }[] = [];
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
    const product = getProduct(id);
    if (!product) {
      return NextResponse.json(
        { error: `Unknown product: ${id}.` },
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
    lines.push({ product, quantity: quantity as number });
  }
  const totalCents = lines.reduce(
    (sum, l) => sum + l.product.priceCents * l.quantity,
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
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: l.product.priceCents,
          product_data: {
            name: l.product.name,
            description: l.product.description,
          },
        },
      })),
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
  // the success page shows the Stripe confirmation either way.
  if (isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { error } = await supabase!.from("orders").insert({
      business: BUSINESS_SLUG,
      customer_name: name.trim(),
      customer_email: email.trim(),
      items: lines.map((l) => ({
        id: l.product.id,
        name: l.product.name,
        price_cents: l.product.priceCents,
        quantity: l.quantity,
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

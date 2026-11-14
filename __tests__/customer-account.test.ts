// lib/customer-account.ts — the customer area's own-data queries.
// The helpers take a Supabase client and the email from the verified
// session and return only that customer's bookings and orders. The
// client is stubbed here (a chainable query builder that records its
// calls), so the tests prove the filters without a live Supabase:
//   - the business filter (salon only — the leads/orders tables are
//     shared with the plumbing demo);
//   - the email match is case-insensitive (ilike) and escaped, so a
//     % or _ in an email cannot widen the match;
//   - a query error, or no rows, comes back as an empty list, never
//     a crash — the page shows its empty state instead.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCustomerBookings,
  getCustomerOrders,
} from "@/lib/customer-account";

type Call = { method: string; args: unknown[] };

function stubClient(rows: unknown[] | null, error: Error | null = null) {
  const calls: Call[] = [];
  const chain = {
    then(
      resolve: (v: { data: unknown[] | null; error: Error | null }) => void
    ) {
      resolve({ data: rows, error });
      return undefined as unknown as Promise<void>;
    },
  } as Record<string, (...args: unknown[]) => unknown>;
  for (const m of ["from", "select", "eq", "ilike", "order"]) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return chain;
    };
  }
  return { client: chain as unknown as SupabaseClient, calls };
}

const bookingRow = {
  id: "1",
  created_at: "2026-11-10T10:00:00Z",
  business: "salon",
  name: "Alex Rivera",
  contact: "alex@example.com",
  service: "Haircut",
  message: null,
  status: "booked",
};

const orderRow = {
  id: "o1",
  created_at: "2026-11-09T10:00:00Z",
  customer_name: "Alex Rivera",
  customer_email: "alex@example.com",
  items: [{ id: "shampoo", name: "Shampoo (1L)", price_cents: 2400, quantity: 1 }],
  total_cents: 2400,
  status: "paid",
};

describe("getCustomerBookings", () => {
  it("queries salon leads whose contact is the session email, newest first", async () => {
    const { client, calls } = stubClient([bookingRow]);
    const rows = await getCustomerBookings(client, "alex@example.com");
    expect(rows).toEqual([bookingRow]);
    expect(calls).toContainEqual({ method: "from", args: ["leads"] });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["business", "salon"],
    });
    expect(calls).toContainEqual({
      method: "ilike",
      args: ["contact", "alex@example.com"],
    });
    expect(calls).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("matches the email case-insensitively through the same ilike filter", async () => {
    const { client, calls } = stubClient([bookingRow]);
    await getCustomerBookings(client, "Alex@Example.com");
    expect(calls).toContainEqual({
      method: "ilike",
      args: ["contact", "Alex@Example.com"],
    });
  });

  it("escapes % and _ in the email so they cannot widen the match", async () => {
    const { client, calls } = stubClient([]);
    await getCustomerBookings(client, "a%b_c@example.com");
    expect(calls).toContainEqual({
      method: "ilike",
      args: ["contact", "a\\%b\\_c@example.com"],
    });
  });

  it("returns an empty list on a query error or no rows", async () => {
    const { client } = stubClient(null, new Error("boom"));
    expect(await getCustomerBookings(client, "alex@example.com")).toEqual(
      []
    );
    const empty = stubClient([]);
    expect(await getCustomerBookings(empty.client, "alex@example.com")).toEqual(
      []
    );
  });
});

describe("getCustomerOrders", () => {
  it("queries salon orders whose customer_email is the session email, newest first", async () => {
    const { client, calls } = stubClient([orderRow]);
    const rows = await getCustomerOrders(client, "alex@example.com");
    expect(rows).toEqual([orderRow]);
    expect(calls).toContainEqual({ method: "from", args: ["orders"] });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["business", "salon"],
    });
    expect(calls).toContainEqual({
      method: "ilike",
      args: ["customer_email", "alex@example.com"],
    });
    expect(calls).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("returns an empty list on a query error or no rows", async () => {
    const { client } = stubClient(null, new Error("boom"));
    expect(await getCustomerOrders(client, "alex@example.com")).toEqual([]);
  });
});

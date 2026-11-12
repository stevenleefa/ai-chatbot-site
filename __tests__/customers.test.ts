// lib/customers.ts — the 12 fictional regulars. Their procedures
// are real slices of the dashboard sales rows, so the summaries
// must tie out to lib/dashboard.ts: 73 procedures out of 1,377
// sales, 11 appointments, 4 customers due a nudge.
import {
  getCustomerSummaries,
  getAppointments,
  getNudgeCustomers,
  getCustomerSummary,
  RETAIL_PRODUCTS,
} from "@/lib/customers";
import { SALES } from "@/lib/dashboard";

describe("customer summaries tie out", () => {
  const summaries = getCustomerSummaries();

  it("has 12 customers", () => {
    expect(summaries.length).toBe(12);
  });

  it("procedures are 73 real slices of the 1,377 dashboard sales", () => {
    const totalProcedures = summaries.reduce(
      (n, s) => n + s.procedures.length,
      0
    );
    expect(totalProcedures).toBe(73);
    expect(summaries.reduce((n, s) => n + s.visits, 0)).toBe(73);
    // Every procedure is a dashboard sale row (same date/service/price).
    for (const s of summaries) {
      for (const p of s.procedures) {
        expect(
          SALES.some(
            (sale) =>
              sale.date === p.date &&
              sale.service === p.service &&
              sale.price === p.price
          )
        ).toBe(true);
      }
    }
  });

  it("services + purchases = total spent, per customer and in total", () => {
    let services = 0;
    let purchases = 0;
    let total = 0;
    for (const s of summaries) {
      expect(s.servicesTotal + s.purchasesTotal).toBeCloseTo(s.totalSpent, 2);
      services += s.servicesTotal;
      purchases += s.purchasesTotal;
      total += s.totalSpent;
    }
    expect(services).toBe(3465);
    expect(purchases).toBe(438);
    expect(total).toBe(3903);
  });

  it("every purchase price matches the shared retail catalogue", () => {
    for (const s of summaries) {
      for (const p of s.purchases) {
        expect(RETAIL_PRODUCTS[p.product]).toBe(p.price);
      }
    }
  });

  it("getCustomerSummary finds a customer by id and returns null otherwise", () => {
    const first = summaries[0];
    expect(getCustomerSummary(first.customer.id)?.customer.id).toBe(
      first.customer.id
    );
    expect(getCustomerSummary("no-such-customer")).toBeNull();
  });
});

describe("appointments and nudges", () => {
  it("has 11 booked appointments, all in November 2026", () => {
    const appts = getAppointments();
    expect(appts.length).toBe(11);
    for (const a of appts) {
      expect(a.date.startsWith("2026-11")).toBe(true);
    }
  });

  it("has 4 customers due a nudge", () => {
    const nudges = getNudgeCustomers();
    expect(nudges.length).toBe(4);
    expect(nudges.map((s) => s.customer.name).sort()).toEqual([
      "Ava Rodriguez",
      "Isabella Chen",
      "Liam O'Connor",
      "Mason Wright",
    ]);
    for (const s of nudges) {
      expect(s.needsNudge).toBe(true);
      expect(s.nudgeMessage.length).toBeGreaterThan(0);
    }
  });
});

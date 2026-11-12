// lib/dashboard.ts — the dashboard's single source of truth.
// These tests pin the figures the owner pages show; they must never
// change unless the sample data itself changes (see DASHBOARD.md).
// Pure computation, no network, no Supabase.
import {
  SALES,
  money,
  revenueForMonth,
  forecastNextMonth,
  salesByService,
  salesByWeek,
  round2,
  sum,
} from "@/lib/dashboard";

describe("dashboard totals", () => {
  it("has 1,377 sales totalling $72,070.00", () => {
    expect(SALES.length).toBe(1377);
    expect(sum(SALES.map((s) => s.price))).toBe(72070);
    expect(money(72070)).toBe("$72,070.00");
  });

  it("monthly revenue ties out to the total", () => {
    const aug = revenueForMonth("2026-08");
    const sep = revenueForMonth("2026-09");
    const oct = revenueForMonth("2026-10");
    expect(aug).toBe(22615);
    expect(sep).toBe(24460);
    expect(oct).toBe(24995);
    expect(aug + sep + oct).toBe(72070);
  });

  it("forecasts November at $23,695.93 (last-4-weeks weekly average x 4.33)", () => {
    const f = forecastNextMonth();
    expect(f.periodStart).toBe("2026-10-04");
    expect(f.periodEnd).toBe("2026-10-31");
    expect(f.periodRevenue).toBe(21890);
    expect(f.weeklyAverage).toBe(5472.5);
    expect(round2(f.projection)).toBe(23695.93);
  });
});

describe("dashboard breakdowns tie out", () => {
  it("sales by service: counts and revenue sum to the totals", () => {
    const byService = salesByService();
    expect(sum(byService.map((r) => r.count))).toBe(1377);
    expect(sum(byService.map((r) => r.revenue))).toBe(72070);
    // Sorted highest revenue first.
    for (let i = 1; i < byService.length; i++) {
      expect(byService[i].revenue).toBeLessThanOrEqual(byService[i - 1].revenue);
    }
  });

  it("sales by week: counts and revenue sum to the totals", () => {
    const byWeek = salesByWeek();
    expect(sum(byWeek.map((r) => r.count))).toBe(1377);
    expect(sum(byWeek.map((r) => r.revenue))).toBe(72070);
    expect(byWeek.length).toBeGreaterThan(0);
  });
});

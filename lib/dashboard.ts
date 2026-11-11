// Owner business dashboard — SAMPLE / DEMO data for Lumen Hair Studio.
//
// Everything here is fictional sample data, defined in code. There is no
// Supabase table and no new env var: the dashboard works with zero
// configuration.
//
// ONE SOURCE OF TRUTH: the seed row lists below are the data, and every
// total on the page is COMPUTED from those rows in this file — never
// hardcoded — so the numbers always tie out:
//   - P&L revenue for a month = sum of that month's sale rows
//   - payroll gross per employee = hourly rate x hours
//   - inventory stock value = sum of qty x unit cost
//   - AP/AR outstanding totals = sum of their unpaid items
//
// The sales rows are the only high-volume table (a realistic salon does
// ~20 appointments a day, so ~700 rows over the sample period). They are
// produced by a small deterministic generator with a FIXED seed, so the
// rows are identical on every render; the generator parameters are the
// seed data, and every aggregate is still computed from the rows it
// produces. The smaller tables (expenses, inventory, bills, invoices,
// employees) are literal row lists. See DASHBOARD.md for how to change
// any of it, or to move the data into Supabase later.
//
// The sample figures are anchored to AS_OF_DATE (2026-10-31) and cover
// three complete months, so every month's revenue is matched against a
// full month of expenses. They do not move with the real calendar —
// update AS_OF_DATE and the seed rows together if you ever want a newer
// sample period.

import { services } from "./business";

// --- Formatting -----------------------------------------------------------

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(month: string): string {
  // "2026-11" -> "November 2026"
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function fmtDate(iso: string): string {
  // "2026-11-07" -> "Nov 7, 2026"
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// --- Anchor date ----------------------------------------------------------

export const AS_OF_DATE = "2026-10-31";
export const SALES_START = "2026-08-01"; // three full months of sales history
export const PL_MONTHS = ["2026-08", "2026-09", "2026-10"];
export const NEXT_PAYROLL_DATE = "2026-11-30";

// --- Sales ----------------------------------------------------------------

export type Sale = {
  date: string; // YYYY-MM-DD
  service: string;
  stylist: string;
  price: number;
  payment: "Card" | "Cash" | "Gift card";
};

// Prices come from the real service list in lib/business.ts, so the
// dashboard can never disagree with the prices on the homepage.
export const SERVICE_PRICES: Record<string, number> = Object.fromEntries(
  services.map((s) => [s.name, parseFloat(s.price.replace(/[^0-9.]/g, ""))])
);

const SERVICE_WEIGHTS: Array<[string, number]> = [
  ["Haircut", 0.45],
  ["Full colour", 0.25],
  ["Balayage", 0.15],
  ["Beard trim", 0.15],
];

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand: () => number, entries: Array<[string, number]>): string {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function dayOfWeek(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay(); // 0 Sun ... 6 Sat
}

function isOpenDay(iso: string): boolean {
  const d = dayOfWeek(iso);
  return d >= 2 && d <= 6; // Tue-Sat — the salon's hours in Aug–Oct
  // 2026, when these sales happened. The salon opened Mondays in
  // November (see lib/customers.ts), but history is not rewritten:
  // do not "fix" this to Mon–Sat; every dashboard figure depends on
  // these rows. See CUSTOMERS.md.
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function generateSales(): Sale[] {
  const rand = mulberry32(20261107); // fixed seed: identical rows every render
  const rows: Sale[] = [];
  for (let date = SALES_START; date <= AS_OF_DATE; date = addDays(date, 1)) {
    if (!isOpenDay(date)) continue;
    const base = dayOfWeek(date) === 6 ? 24 : 20; // Saturdays are busier
    const count = base + Math.floor(rand() * 5) - 2; // +/-2 variation
    for (let i = 0; i < count; i++) {
      const service = pickWeighted(rand, SERVICE_WEIGHTS);
      // Colour work goes mostly to the colour specialist.
      const stylist =
        service === "Full colour" || service === "Balayage"
          ? pickWeighted(rand, [
              ["Amelia Brooks", 0.5],
              ["Maya Chen", 0.25],
              ["Sofia Reyes", 0.25],
            ])
          : pickWeighted(rand, [
              ["Maya Chen", 0.35],
              ["Sofia Reyes", 0.3],
              ["Jordan Lee", 0.2],
              ["Amelia Brooks", 0.15],
            ]);
      const payment = pickWeighted(rand, [
        ["Card", 0.65],
        ["Cash", 0.25],
        ["Gift card", 0.1],
      ]) as Sale["payment"];
      rows.push({ date, service, stylist, price: SERVICE_PRICES[service], payment });
    }
  }
  return rows;
}

export const SALES: Sale[] = generateSales();

export function monthOf(iso: string): string {
  return iso.slice(0, 7); // "2026-11-07" -> "2026-11"
}

export function salesInRange(start: string, end: string): Sale[] {
  return SALES.filter((s) => s.date >= start && s.date <= end);
}

export function revenueForMonth(month: string): number {
  return sum(SALES.filter((s) => monthOf(s.date) === month).map((s) => s.price));
}

export function salesByService(): Array<{ service: string; count: number; revenue: number }> {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const s of SALES) {
    const row = map.get(s.service) ?? { count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += s.price;
    map.set(s.service, row);
  }
  return Array.from(map.entries())
    .map(([service, v]) => ({ service, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function salesByWeek(): Array<{ weekStart: string; count: number; revenue: number }> {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const s of SALES) {
    const d = new Date(s.date + "T12:00:00Z");
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const row = map.get(key) ?? { count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += s.price;
    map.set(key, row);
  }
  return Array.from(map.entries())
    .map(([weekStart, v]) => ({ weekStart, ...v }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function forecastNextMonth(): {
  periodStart: string;
  periodEnd: string;
  periodRevenue: number;
  weeklyAverage: number;
  projection: number;
} {
  // Average weekly revenue over the last 4 weeks x 4.33 weeks/month.
  const periodStart = addDays(AS_OF_DATE, -27); // last 28 days, inclusive
  const periodRevenue = sum(salesInRange(periodStart, AS_OF_DATE).map((s) => s.price));
  const weeklyAverage = periodRevenue / 4;
  return {
    periodStart,
    periodEnd: AS_OF_DATE,
    periodRevenue,
    weeklyAverage,
    projection: weeklyAverage * 4.33,
  };
}

// --- Employees & payroll --------------------------------------------------

export type Employee = {
  name: string;
  role: string;
  hourlyRate: number;
  hoursPerWeek: number;
};

export const EMPLOYEES: Employee[] = [
  { name: "Maya Chen", role: "Owner / Senior Stylist", hourlyRate: 32, hoursPerWeek: 36 },
  { name: "Sofia Reyes", role: "Stylist", hourlyRate: 26, hoursPerWeek: 32 },
  { name: "Amelia Brooks", role: "Colour Specialist", hourlyRate: 28, hoursPerWeek: 30 },
  { name: "Jordan Lee", role: "Junior Stylist", hourlyRate: 19, hoursPerWeek: 28 },
  { name: "Priya Nair", role: "Receptionist", hourlyRate: 21, hoursPerWeek: 24 },
];

// Monthly hours from contracted weekly hours: 52 weeks / 12 months.
export const WEEKS_PER_MONTH = 52 / 12;

export function monthlyHours(e: Employee): number {
  return e.hoursPerWeek * WEEKS_PER_MONTH;
}

export function monthlyGross(e: Employee): number {
  return round2(e.hourlyRate * monthlyHours(e));
}

// Simplified flat-rate deductions used ONLY for this demo.
export const INCOME_TAX_RATE = 0.2; // 20% income tax estimate
export const OTHER_DEDUCTION_RATE = 0.05; // 5% pension + other, estimate

export type PayrollRow = {
  name: string;
  role: string;
  hourlyRate: number;
  hours: number;
  gross: number;
  incomeTax: number;
  otherDeductions: number;
  net: number;
};

export function payrollForMonth(month: string): {
  month: string;
  rows: PayrollRow[];
  grossTotal: number;
  taxTotal: number;
  otherTotal: number;
  netTotal: number;
} {
  // Each component is rounded to cents first, so the displayed total is
  // exactly the sum of the displayed rows.
  const rows = EMPLOYEES.map((e) => {
    const hours = round2(monthlyHours(e));
    const gross = monthlyGross(e);
    const incomeTax = round2(gross * INCOME_TAX_RATE);
    const otherDeductions = round2(gross * OTHER_DEDUCTION_RATE);
    return {
      name: e.name,
      role: e.role,
      hourlyRate: e.hourlyRate,
      hours,
      gross,
      incomeTax,
      otherDeductions,
      net: round2(gross - incomeTax - otherDeductions),
    };
  });
  return {
    month,
    rows,
    grossTotal: round2(sum(rows.map((r) => r.gross))),
    taxTotal: round2(sum(rows.map((r) => r.incomeTax))),
    otherTotal: round2(sum(rows.map((r) => r.otherDeductions))),
    netTotal: round2(sum(rows.map((r) => r.net))),
  };
}

// --- Expenses & P&L ---------------------------------------------------------

export type Expense = { month: string; category: string; amount: number };

export const EXPENSES: Expense[] = [
  // August 2026
  { month: "2026-08", category: "Rent", amount: 2200 },
  { month: "2026-08", category: "Products & supplies", amount: 1380 },
  { month: "2026-08", category: "Utilities", amount: 395 },
  { month: "2026-08", category: "Marketing", amount: 250 },
  { month: "2026-08", category: "Insurance", amount: 180 },
  // September 2026
  { month: "2026-09", category: "Rent", amount: 2200 },
  { month: "2026-09", category: "Products & supplies", amount: 1420 },
  { month: "2026-09", category: "Utilities", amount: 410 },
  { month: "2026-09", category: "Marketing", amount: 250 },
  { month: "2026-09", category: "Insurance", amount: 180 },
  // October 2026
  { month: "2026-10", category: "Rent", amount: 2200 },
  { month: "2026-10", category: "Products & supplies", amount: 1580 },
  { month: "2026-10", category: "Utilities", amount: 445 },
  { month: "2026-10", category: "Marketing", amount: 300 },
  { month: "2026-10", category: "Insurance", amount: 180 },
];

export type ProfitLossRow = {
  month: string;
  revenue: number;
  wages: number;
  otherExpenses: number;
  totalExpenses: number;
  profit: number;
};

export function profitAndLoss(): ProfitLossRow[] {
  return PL_MONTHS.map((month) => {
    const revenue = revenueForMonth(month);
    const wages = payrollForMonth(month).grossTotal;
    const otherExpenses = round2(
      sum(EXPENSES.filter((e) => e.month === month).map((e) => e.amount))
    );
    const totalExpenses = round2(wages + otherExpenses);
    return { month, revenue, wages, otherExpenses, totalExpenses, profit: round2(revenue - totalExpenses) };
  });
}

// --- Inventory --------------------------------------------------------------

export type InventoryItem = {
  name: string;
  qty: number;
  reorderLevel: number;
  unitCost: number;
};

export const INVENTORY: InventoryItem[] = [
  { name: "Shampoo (1L)", qty: 18, reorderLevel: 10, unitCost: 12.5 },
  { name: "Conditioner (1L)", qty: 14, reorderLevel: 10, unitCost: 11 },
  { name: "Colour tubes (assorted)", qty: 42, reorderLevel: 20, unitCost: 8.75 },
  { name: "Developer 20 vol (1L)", qty: 9, reorderLevel: 12, unitCost: 9.5 },
  { name: "Developer 30 vol (1L)", qty: 11, reorderLevel: 12, unitCost: 9.5 },
  { name: "Foils (500 pack)", qty: 3, reorderLevel: 5, unitCost: 14 },
  { name: "Gloves (box of 100)", qty: 22, reorderLevel: 10, unitCost: 6.25 },
  { name: "Hairspray", qty: 7, reorderLevel: 8, unitCost: 10.5 },
  { name: "Styling gel", qty: 12, reorderLevel: 6, unitCost: 8 },
  { name: "Towels (pack)", qty: 30, reorderLevel: 15, unitCost: 4.5 },
  { name: "Styling capes", qty: 8, reorderLevel: 4, unitCost: 18 },
  { name: "Toner", qty: 6, reorderLevel: 8, unitCost: 13.25 },
];

export function stockValue(item: InventoryItem): number {
  return round2(item.qty * item.unitCost);
}

export function totalStockValue(): number {
  return round2(sum(INVENTORY.map(stockValue)));
}

export function isLowStock(item: InventoryItem): boolean {
  return item.qty <= item.reorderLevel;
}

export function lowStockCount(): number {
  return INVENTORY.filter(isLowStock).length;
}

// --- Accounts payable / receivable ------------------------------------------

export type Bill = {
  supplier: string;
  description: string;
  amount: number;
  due: string; // YYYY-MM-DD
  paid: boolean;
};

export const PAYABLES: Bill[] = [
  { supplier: "Maple Street Properties", description: "October rent", amount: 2200, due: "2026-10-01", paid: true },
  { supplier: "City Power & Light", description: "September utilities", amount: 410, due: "2026-10-28", paid: false },
  { supplier: "Beauty Supply Co.", description: "Colour + developer order", amount: 486.2, due: "2026-11-06", paid: false },
  { supplier: "Salon Essentials Ltd", description: "Shampoo & conditioner restock", amount: 312.75, due: "2026-11-12", paid: false },
  { supplier: "Fresh Linen Service", description: "Weekly towel service", amount: 156.4, due: "2026-11-02", paid: false },
  { supplier: "Local Magazine", description: "October ad", amount: 300, due: "2026-10-20", paid: true },
];

export type Invoice = {
  client: string;
  description: string;
  amount: number;
  due: string; // YYYY-MM-DD
  paid: boolean;
};

export const RECEIVABLES: Invoice[] = [
  { client: "Bright Events", description: "Corporate styling session", amount: 385, due: "2026-10-27", paid: false },
  { client: "City Gala", description: "Event styling — 4 guests", amount: 520, due: "2026-10-24", paid: false },
  { client: "Emily R.", description: "Bridal party — 5 guests", amount: 420, due: "2026-11-04", paid: false },
  { client: "Sarah K.", description: "Wedding hair trial", amount: 150, due: "2026-11-07", paid: false },
  { client: "Dana M.", description: "Monthly colour package", amount: 210, due: "2026-11-14", paid: false },
  { client: "Studio Nine", description: "Photo shoot styling", amount: 275, due: "2026-10-22", paid: true },
];

export type BillStatus = "paid" | "unpaid" | "overdue";

export function billStatus(item: { due: string; paid: boolean }): BillStatus {
  if (item.paid) return "paid";
  return item.due < AS_OF_DATE ? "overdue" : "unpaid";
}

export function outstandingTotal(
  items: Array<{ amount: number; due: string; paid: boolean }>
): number {
  return round2(sum(items.filter((i) => !i.paid).map((i) => i.amount)));
}

// --- Taxes --------------------------------------------------------------------

export const SALES_TAX_RATE = 0.085; // 8.5% estimated sales tax on services

export function salesTaxCollected(month: string): number {
  return round2(revenueForMonth(month) * SALES_TAX_RATE);
}

export const QUARTERLY_TAX_RATE = 0.2; // 20% of profit set aside for income tax

export function quarterlyTaxSetAside(): { months: string[]; profit: number; setAside: number } {
  const months = ["2026-10"]; // Q4 to date (October 2026)
  const pl = profitAndLoss();
  const profit = round2(sum(pl.filter((r) => months.includes(r.month)).map((r) => r.profit)));
  return { months, profit, setAside: round2(profit * QUARTERLY_TAX_RATE) };
}

// --- Overview KPIs --------------------------------------------------------------

export function overview(): {
  revenueThisMonth: number;
  profitThisMonth: number;
  receivablesOutstanding: number;
  payablesOutstanding: number;
  lowStock: number;
  nextPayrollDate: string;
} {
  const november = profitAndLoss().find((r) => r.month === "2026-10")!;
  return {
    revenueThisMonth: november.revenue,
    profitThisMonth: november.profit,
    receivablesOutstanding: outstandingTotal(RECEIVABLES),
    payablesOutstanding: outstandingTotal(PAYABLES),
    lowStock: lowStockCount(),
    nextPayrollDate: NEXT_PAYROLL_DATE,
  };
}

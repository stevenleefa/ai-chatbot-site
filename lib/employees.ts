// Employees — SAMPLE / DEMO data for Lumen Hair Studio.
//
// Everything here is fictional sample data, computed from the rows
// already in the project. There is no Supabase table and no new env
// var: the employees pages work with zero configuration.
//
// ONE SOURCE OF TRUTH, like the dashboard and customers: every number
// is COMPUTED from existing rows — never hardcoded — so the numbers
// always tie out:
//   - sales are the employee's rows in the dashboard SALES array
//     (stylist === their name); the five employees' sales add up to
//     the dashboard's 1,377 sales, $72,070 total
//   - products sold are the customers' retail purchases, credited to
//     the customer's PREFERRED stylist — the stylist who looks after
//     that customer is the one who sold them the product. (Purchases
//     have no stylist of their own in lib/customers.ts, so this rule
//     is the credit rule; see EMPLOYEES.md.)
//   - customers served are the regulars with at least one procedure
//     by this employee, plus any regular whose preferred stylist is
//     them (the second group is inside the first — preferred stylist
//     is always one of their procedure stylists — but both rules are
//     kept so the intent is explicit)
//   - appointments are their November diary rows from
//     getAppointments() in lib/customers.ts
//   - payroll is their October pay-run row from payrollForMonth()
//   - monthly gross / hours come from the dashboard helpers
//
// lib/dashboard.ts is only READ, never modified, so every verified
// dashboard figure stays byte-identical.
//
// Employee ids are first-name slugs (maya, sofia, amelia, jordan,
// priya) — all five first names are distinct, and the short URLs
// (/employees/maya) read well. See EMPLOYEES.md.

import {
  EMPLOYEES,
  SALES,
  monthlyGross,
  monthlyHours,
  payrollForMonth,
  round2,
  sum,
  type Employee,
  type PayrollRow,
  type Sale,
} from "./dashboard";
import {
  getAppointments,
  getCustomerSummaries,
  type Appointment,
  type Purchase,
} from "./customers";

export const PAYROLL_MONTH = "2026-10";

// "Maya Chen" -> "maya". All five first names are distinct.
export function employeeIdForName(name: string): string {
  return name.split(" ")[0].toLowerCase();
}

export type EmployeeProductSale = Purchase & {
  customerId: string;
  customerName: string;
};

export type EmployeeCustomer = {
  id: string;
  name: string;
  visitsWithEmployee: number; // procedures done by this employee
  spentWithEmployee: number; // services total with this employee
};

export type EmployeeSummary = {
  employee: Employee;
  id: string;
  sales: Sale[]; // date order, oldest first
  salesCount: number;
  salesRevenue: number;
  salesByService: Array<{ service: string; count: number; revenue: number }>;
  productsSold: EmployeeProductSale[]; // date order, oldest first
  productsCount: number;
  productsValue: number;
  customers: EmployeeCustomer[]; // most visits with this employee first
  appointments: Array<Appointment & { customerName: string }>; // November diary order
  payroll: PayrollRow | null; // October pay run
  monthlyHours: number;
  monthlyGross: number;
};

function salesByService(sales: Sale[]): EmployeeSummary["salesByService"] {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const s of sales) {
    const row = map.get(s.service) ?? { count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += s.price;
    map.set(s.service, row);
  }
  return Array.from(map.entries())
    .map(([service, v]) => ({ service, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

function buildSummaries(): EmployeeSummary[] {
  const summaries = getCustomerSummaries();
  const appointments = getAppointments();
  const payrollRows = payrollForMonth(PAYROLL_MONTH).rows;
  const customerName = new Map(
    summaries.map((s) => [s.customer.id, s.customer.name])
  );

  return EMPLOYEES.map((employee) => {
    const sales = SALES.filter((s) => s.stylist === employee.name);
    const productsSold: EmployeeProductSale[] = [];
    const customers: EmployeeCustomer[] = [];
    for (const s of summaries) {
      const ownProcedures = s.procedures.filter(
        (p) => p.stylist === employee.name
      );
      if (
        ownProcedures.length > 0 ||
        s.preferredStylist === employee.name
      ) {
        customers.push({
          id: s.customer.id,
          name: s.customer.name,
          visitsWithEmployee: ownProcedures.length,
          spentWithEmployee: round2(
            sum(ownProcedures.map((p) => p.price))
          ),
        });
      }
      if (s.preferredStylist === employee.name) {
        for (const p of s.purchases) {
          productsSold.push({
            ...p,
            customerId: s.customer.id,
            customerName: s.customer.name,
          });
        }
      }
    }
    productsSold.sort((a, b) => a.date.localeCompare(b.date));
    customers.sort(
      (a, b) =>
        b.visitsWithEmployee - a.visitsWithEmployee ||
        a.name.localeCompare(b.name)
    );
    return {
      employee,
      id: employeeIdForName(employee.name),
      sales,
      salesCount: sales.length,
      salesRevenue: round2(sum(sales.map((s) => s.price))),
      salesByService: salesByService(sales),
      productsSold,
      productsCount: productsSold.length,
      productsValue: round2(sum(productsSold.map((p) => p.price))),
      customers,
      appointments: appointments
        .filter((a) => a.stylist === employee.name)
        .map((a) => ({
          ...a,
          customerName: customerName.get(a.customerId) ?? a.customerId,
        })),
      payroll:
        payrollRows.find((r) => r.name === employee.name) ?? null,
      monthlyHours: round2(monthlyHours(employee)),
      monthlyGross: monthlyGross(employee),
    };
  });
}

const SUMMARIES: EmployeeSummary[] = buildSummaries();

export function getEmployeeSummaries(): EmployeeSummary[] {
  // Highest sales revenue first.
  return [...SUMMARIES].sort((a, b) => b.salesRevenue - a.salesRevenue);
}

export function getEmployeeSummary(id: string): EmployeeSummary | null {
  return SUMMARIES.find((s) => s.id === id) ?? null;
}

# Owner Business Dashboard — Lumen Hair Studio

A back-office dashboard for the salon demo at **`/dashboard`**. It shows the
numbers a real salon owner would want at a glance: sales, forecast, profit &
loss, employees, payroll, taxes, inventory, accounts payable and accounts
receivable.

## How to view it

- Sign in at `/login` first. `/dashboard` requires a signed-in account
  with an active staff or admin profile (see AUTH.md); signed-out users
  are sent to `/login`. There is no shared token any more — the old
  `LEADS_OWNER_TOKEN` is gone and unused.
- No Supabase setup and no new env vars are needed for the dashboard's
  sample data. The dashboard works with zero configuration.

## Navigating it

- The section buttons at the top work like tabs: clicking one shows just
  that section in place (the page doesn't jump down to it), and **Overview**
  shows everything again. The buttons stick to the top while you scroll, so
  they're always in reach — they stick just below the fixed top nav.
  That offset is measured, not guessed: the nav wraps to two rows at
  most widths, so `components/NavHeight.tsx` measures its real height
  in the browser and writes it into `--nav-height`; the tabs read it
  (`top: var(--nav-height)`). Before 2026-11-11 the offset was a
  fixed 64px, so on a normal-width window the tabs stuck 44px too
  high and slid underneath the fixed nav. Clicking a tab also scrolls
  the tab row itself into view with a matching scroll margin, so it
  never lands hidden under the nav.
- Where a list has dates with money, a line chart sits underneath it
  as a visual: weekly revenue under Sales by week, monthly revenue vs
  profit under P&L, and sales tax collected by month under Taxes. Each
  chart is a line (or two lines) with a dot at every data point, a real
  x-axis (dates/months) and y-axis (money values with a label and light
  gridlines); hovering a dot shows its exact value, and the numbers in
  the tables stay the source of truth. The charts are drawn by
  `components/LineChart.tsx` (plain SVG, no chart library). They were
  bar charts until 2026-11-10: the bar chart put a money label above
  every bar, and with 13 weekly bars the labels overlapped, so the
  charts became lines with no per-point text labels.

## What it shows

| Section | What it shows |
|---|---|
| Overview | Revenue this month, profit this month, receivables/payables outstanding, low-stock count, next payroll date |
| Sales | Every sample sale (Aug 1 – Oct 31, 2026), totals by service and by week, best sellers, 50 most recent sales |
| Forecast | Next-month revenue projection = average weekly revenue of the last 4 weeks × 4.33, with the method shown on the page |
| P&L | Monthly profit & loss for Aug / Sep / Oct 2026: revenue − (wages + other expenses) = profit |
| Employees | 5 fictional staff with role, hourly rate, contracted hours, monthly hours and monthly gross |
| Payroll | Monthly pay run: gross, simplified deductions (20% income tax estimate + 5% other), net pay, totals |
| Taxes | Sales tax collected (8.5% of sales, estimate) and a quarterly income-tax set-aside (20% of Q4 profit to date, estimate) |
| Inventory | Products with qty on hand, reorder level, unit cost, stock value, low-stock flags |
| Accounts payable | Supplier bills with due dates and paid / unpaid / overdue status |
| Accounts receivable | Client invoices with due dates and paid / unpaid / overdue status |

Customer histories are derived from these same sales rows — the
regulars' visits are a subset of `SALES` (see CUSTOMERS.md).

## Where the data lives — and how to change it

All of it is in **`lib/dashboard.ts`**:

- `SALES` — individual sales. A realistic salon does ~20 appointments a
  day, so ~700 rows over the sample period: they are produced by a small
  deterministic generator (fixed seed `20261107`) in `generateSales()`, so
  the rows are identical on every render. Service prices come from the real
  service list in `lib/business.ts`, so the dashboard can never disagree
  with the prices on the homepage. To use literal rows instead, replace
  `generateSales()` with a hand-written `Sale[]` list.
- `EMPLOYEES` — staff list. Monthly hours = contracted weekly hours × 52 ÷ 12.
- `EXPENSES` — rent, products & supplies, utilities, marketing, insurance,
  per month.
- `INVENTORY` — products with qty, reorder level and unit cost.
- `PAYABLES` / `RECEIVABLES` — bills and invoices with amount, due date and
  paid flag. "Overdue" is computed: unpaid with a due date before the
  anchor date.
- `AS_OF_DATE` (`2026-10-31`) — the sample figures are anchored to this
  date and cover three complete months, so every month's revenue is
  matched against a full month of expenses. Update it together with the
  seed rows if you ever want a newer sample period.

**One source of truth:** every total on the page is computed from those
rows in `lib/dashboard.ts` — never hardcoded. P&L revenue for a month is
the sum of that month's sale rows; payroll gross is hourly rate × hours;
inventory stock value is the sum of qty × unit cost; AP/AR totals are the
sum of their unpaid items. Payroll components are rounded to cents first,
so a displayed total is exactly the sum of its displayed rows.

## Disclaimers (also shown on the page)

- **Sample demo data — not a real business's figures.** Lumen Hair Studio
  is a fictional demo business; all figures are made-up sample data, shown
  so a real business can see what their dashboard would look like.
- **Projection — an estimate, not a guarantee.** The forecast is a simple
  trend projection, not a promise.
- **Demo estimates — not payroll or tax advice.** Payroll deductions and
  the tax figures use simplified flat rates (20% income tax estimate, 5%
  other; 8.5% sales tax estimate; 20% quarterly set-aside). A real business
  files through a licensed payroll provider and their accountant.

## Future v2 idea

Move the data into Supabase tables (one table per section, same project
as the `leads` table, RLS on with no public policies, service-role key
server-side) so the owner can add/edit sales, expenses, inventory and
bills from the site itself, instead of editing `lib/dashboard.ts`. The
page already computes everything from row lists, so swapping the seed
lists for Supabase queries is a contained change.

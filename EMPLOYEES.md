# Employees — Lumen Hair Studio

Per-employee numbers for the salon demo at **`/employees`**, with a
detail page per employee at **`/employees/<id>`** (ids are first-name
slugs: `maya`, `sofia`, `amelia`, `jordan`, `priya`). Like the
dashboard and the customers pages, everything is fictional sample
data computed in code — no Supabase table, no new env var.

## How to view it

- Sign in at `/login` first. `/employees` requires a signed-in account
  with an active staff or admin profile (see AUTH.md); signed-out users
  are sent to `/login`.
- Staff names are links everywhere they appear — the dashboard
  Employees and Payroll tables, the dashboard Recent sales table, the
  appointments diary, and customer pages (preferred stylist, procedure
  rows, booked-appointment line) — so an employee is always one click
  from their numbers. The OwnerNav has an Employees button for all
  signed-in staff.

## What each employee page shows

| Section | What it shows |
|---|---|
| Sales | Their sales rows: count, revenue, breakdown by service, recent sales |
| Products sold | Retail purchases credited to them (see the credit rule below) |
| Customers | Regulars they look after, with visits and spend with them |
| Appointments | Their November 2026 diary |
| Payroll | Their October 2026 pay-run row (hours, gross, deductions, net) |

The list at `/employees` is sorted by sales revenue, highest first.

Every table on the list and detail pages sorts — click a column
heading to sort by that column, click it again to reverse; the
sorted column shows an arrow (▲ ascending, ▼ descending). Money and
counts sort numerically, dates sort by their date value. The one
table that does not sort is Payroll on an employee page: it has a
single row, so there is nothing to sort. Sorting is one shared
component, `components/SortableTable.tsx` — see CUSTOMERS.md.

## Where the numbers come from

All of it is computed in `lib/employees.ts` from rows that already
exist — nothing is hardcoded, so the numbers always tie out:

- **Sales** — their rows in the dashboard `SALES` array
  (`stylist === name`). The five employees' sales add up to the
  dashboard's 1,377 sales and $72,070 total. `lib/dashboard.ts` is
  only read, never modified.
- **Products sold** — the customers' retail purchases from
  `lib/customers.ts`, credited to the customer's **preferred
  stylist**. Purchases have no stylist of their own, so this is the
  credit rule: the stylist who looks after the customer is the one
  who sold them the product.
- **Customers served** — regulars with at least one procedure by this
  employee, plus any regular whose preferred stylist is them. (The
  second group is inside the first — a preferred stylist is always
  one of their procedure stylists — but both rules are kept so the
  intent is explicit.)
- **Appointments** — their rows in the November diary from
  `getAppointments()` in `lib/customers.ts`, filtered by stylist.
- **Payroll** — their October pay-run row from `payrollForMonth()` in
  `lib/dashboard.ts`. Deductions are the same simplified flat rates
  as the dashboard (20% income tax estimate + 5% other).
- **Monthly gross / hours** — the dashboard helpers `monthlyGross()`
  and `monthlyHours()` (hourly rate × contracted hours).

Priya Nair is the receptionist: she never appears as a stylist in
`SALES`, so she has no sales, products, customers or appointments —
her page shows that plainly, with her pay run below. That is correct,
not a gap.

## Standard colour coding

One colour per category, used the same way on `/employees`,
`/customers` and `/appointments` (defined once in
`app/globals.css` as CSS variables, rendered as `.tag` pills; the
key is the `components/ColourLegend.tsx` row on those three pages):

| Colour | Hex | Category | Used for |
|---|---|---|---|
| Deep purple | `#5b21b6` | People | Customer + employee names, Customers sections |
| Dark grey | `#374151` | Money | Sales revenue, totals, net pay — the headline money figure of a section, as a money chip |
| Dark navy | `#1e3a5f` | Appointments | Appointment sections, diary date columns, Due-for-a-visit |
| Medium grey | `#6b7280` | Products | Purchases, Products sold, "Might be interested in" |
| Medium purple | `#7c3aed` | Services | Procedures / services sections and columns |

The palette is dark navy, purples and greys, and every chip is
white text on its colour, passing WCAG 2.1 AA (contrast 4.5:1 or
better: people 8.98:1, money 10.31:1, appointments 11.50:1,
products 4.83:1, services 5.70:1). The previous palette did not
fully pass: the old orange Products chip was 3.99:1 and the old
rose Services chip 3.80:1 against white text, both below the
4.5:1 AA bar for normal text.

Rules of the scheme:

- A section's heading carries its category chip (for example, the
  employee page's Sales heading has the dark grey Money chip, Products
  sold has the medium grey Products chip).
- Headline money totals are shown as dark grey money chips (the revenue
  total under Sales, the products total under Products sold, the net
  pay under Payroll, the products total row on a customer page).
- List tables put the category chip in the column header (for
  example, Sales revenue → Money, Products sold → Products).
- Status badges keep their existing colours (green/red for
  confirmed/requested, paid/unpaid/overdue) — they encode *state*,
  not category, so they are not recoloured.
- The public site and the dashboard's own tables are NOT recoloured —
  the scheme is scoped to the owner-area lists and detail pages
  named above.

## Stylist colours (separate coding)

On top of the category colours, each stylist has their OWN colour,
used only for appointments: the calendar blocks on `/appointments`
are coloured by stylist, and a small dot in the stylist's colour
sits next to their name in the diary table. A legend row under the
calendar (swatch + name per stylist) is the key. This is a separate
coding from the tag chips above — a stylist colour identifies a
person, a tag colour identifies a category — so the two never
conflict. The mapping lives in `STYLIST_COLOURS` in
`lib/employees.ts` (one source of truth; the calendar, the diary
dots, the filter buttons and the legend all read it):

| Stylist | Colour | Hex | White-text contrast |
|---|---|---|---|
| Amelia Brooks | Dark navy | `#1e3a5f` | 11.50:1 |
| Sofia Reyes | Deep purple | `#5b21b6` | 8.98:1 |
| Maya Chen | Medium purple | `#7c3aed` | 5.70:1 |
| Jordan Lee | Dark grey | `#374151` | 10.31:1 |
| Priya Nair | Medium grey | `#6b7280` | 4.83:1 |

All five pass WCAG 2.1 AA with white text (4.5:1 or better). Priya
is the receptionist and has no appointments, so her colour appears
only in the legend and her filter button — filtering to her shows
the empty state.

## How to change it

- To change who works at the salon, edit the `EMPLOYEES` list in
  `lib/dashboard.ts` (name, role, hourly rate, hours per week).
  Everything here follows from that list plus the sales rows — a new
  employee with no sales simply shows zeros.
- To change the products-credit rule, edit the preferred-stylist
  check in `lib/employees.ts` (`buildSummaries`).
- To change a colour, edit the `--tag-*` variables in
  `app/globals.css` — every chip follows the variable, so the whole
  owner area changes at once. To change a stylist's colour, edit
  `STYLIST_COLOURS` in `lib/employees.ts` — the calendar blocks,
  diary dots, filter buttons and legend all follow it (keep the new
  colour dark enough for white text: contrast 4.5:1 or better).

## Files

| File | What it is |
|---|---|
| `lib/employees.ts` | Per-employee derivation (sales, products, customers, appointments, payroll) |
| `app/employees/page.tsx` | Employees list (owner-gated) |
| `app/employees/[id]/page.tsx` | Employee detail (owner-gated, unknown id → 404) |
| `app/employees/loading.tsx`, `app/employees/[id]/loading.tsx` | Loading states |
| `components/ColourLegend.tsx` | The shared colour-key row |
| `components/SortableTable.tsx` | Shared sortable table used by every owner-area table |
| `components/OwnerNav.tsx` | Now also has an Employees button |
| `middleware.ts` | `/employees` added to the guarded routes |
| `app/globals.css` | `--tag-*` variables, `.tag` / `.tag-*` / `.colour-legend` |
| `app/dashboard/page.tsx` | Employee names now link to their pages |
| `app/appointments/page.tsx` | Stylist links, header chips, legend, filter + views (via AppointmentsView) |
| `components/AppointmentsView.tsx` | Stylist filter buttons, Month/Week/Day switcher, calendar + diary |
| `components/AppointmentCalendar.tsx` | Month / Week / Day calendar, blocks coloured by stylist |
| `lib/format.ts` | `formatTime` (12-hour clock) — no data imports |
| `app/customers/page.tsx`, `app/customers/[id]/page.tsx` | Legend, header/section chips, stylist links |
| `EMPLOYEES.md` | This file |

# Customers & Appointments — Lumen Hair Studio

A customers area and an appointments diary for the salon demo, at
**`/customers`** (list + one page per customer) and **`/appointments`**
(November 2026 diary). Both are owner-only: sign in at `/login` first;
the middleware guards them and the pages check the session themselves,
exactly like `/leads` and `/dashboard` (see AUTH.md). There is no
shared token any more.

Staff names are links everywhere too — see **EMPLOYEES.md** for the
employees area (`/employees`, per-employee sales / products /
customers / appointments / payroll) and the standard colour coding
used across the owner pages.

## What it shows

| Page | What it shows |
|---|---|
| `/customers` | 12 fictional regular customers, sorted by next due date soonest: name (clickable), contact, last visit, next due, status (Needs a nudge / Booked), visits, total spent |
| `/customers/<id>` | One customer: contact + since + preferred stylist, visits / total spent / last visit / next due, then four areas — Procedures (past services), Purchases (retail products), Might be interested in (suggestions with reasons), Due for a visit (next due date, status, suggested nudge message or booked appointment) |
| `/appointments` | November 2026 diary: date, time, customer (clickable to their page), service, stylist, status (Confirmed / Requested); then Due for a booking — regulars who are due with no appointment, i.e. the nudge cases |
| Homepage | A small Appointments card just under the hero — signed-in owners only (visitors never see it), linking to `/appointments` |

## Sorting the tables

Every owner-area table sorts — the customers and employees lists,
the appointments diary and Due-for-a-booking list, the leads table,
the Procedures and Purchases tables on a customer page, the Sales /
Products sold / Customers / Appointments tables on an employee page,
and all eleven tables on the dashboard. Click a column heading to
sort by that column; click it again to reverse it. The sorted column
shows an arrow (▲ ascending, ▼ descending). The default order is
unchanged until a header is clicked (customers by next due soonest,
employees by sales revenue, the diary by date, leads newest first).
Money and counts sort numerically, dates sort by their date value
(not the display text), text sorts alphabetically. Totals rows stay
at the bottom — sorting never moves a total. One shared component
does it everywhere: `components/SortableTable.tsx` (a client
component; the pages stay server components and pass the row cells
and one sort value per cell as props). The one table that does not
sort is the Payroll table on an employee page — it has a single row,
so there is nothing to sort.

## The November calendar

`/appointments` has a month calendar above the diary table
(`components/AppointmentCalendar.tsx`, server-rendered, no client
JS). November 2026, Sunday-start weeks: Nov 1 is a Sunday and the
month has 30 days, so the grid is 5 rows — Nov 1–30 plus Dec 1–5
filling the last row, muted. Each day cell shows that day's
appointments as small navy blocks: time + customer name (a link to
`/customers/<id>`) and the stylist name (a link to
`/employees/<id>`). Sundays and Mondays are closed — those cells are
greyed out and labelled Closed. The diary covers November 2026
only: all 8 booked appointments are in November and there is no
data for other months, so there is no month navigation.

## Where the data lives — and how to change it

All of it is in **`lib/customers.ts`**. The roster is the only
hand-written data: 12 fictional regulars (id slug, name, phone, email)
plus the retail products each one bought. Everything else is computed
from those rows plus the dashboard's sales rows — never hardcoded.

- **Procedures** — each regular's past services are a subset of the
  dashboard `SALES` rows (see "The sales tie-in" below). Date, service,
  stylist and price all come from the sale row.
- **Purchases** — literal `{ date, product }` rows in the roster; the
  price comes from `RETAIL_PRODUCTS` in the same file, so a product can
  never disagree with its price. Purchase dates are always one of that
  customer's visit dates.
- **Visits / total spent / last visit** — counted and summed from the
  procedures + purchases. Total spent = services + products.
- **Preferred stylist** — the stylist of the most visits; ties go to
  the stylist of the most recent visit.
- **Due dates** — one per recurring service (had 2+ times): last date
  of that service + its usual interval. If a customer has no recurring
  service, their most recent visit sets the due date. The customer's
  next due date is the soonest of those.
- **Usual intervals** (`SERVICE_INTERVAL_DAYS`): Haircut 6 weeks (42
  days), Beard trim 3 weeks (21), Full colour 8 weeks (56), Balayage
  10 weeks (70).
- **"Today" in this demo world** is `AS_OF_DATE` (2026-10-31, the
  dashboard's anchor). A customer is **overdue** when their next due
  date is before Oct 31, and **due soon** when it is within
  `NUDGE_WITHIN_DAYS` (7) days after Oct 31.
- **Appointments** — a booked next visit for most regulars, at their
  next due date (shifted forward to the next open day if it falls on a
  Sunday or Monday), in November 2026, with a time from a fixed slot
  list (09:00–16:30) and their preferred stylist. Status is
  "requested" for every fourth regular (roster index % 4 === 2), the
  rest are "confirmed". Regulars who are overdue or due soon are NOT
  booked — they are the nudge cases.
- **Needs a nudge** — next due date is past or within 7 days AND no
  appointment is booked. (By construction every other regular has a
  booking, so the nudge set is exactly the overdue / due-soon set.)
- **Nudge message** — uses the customer's first name, the service
  they are due for, and how long since their last one of those
  ("it's been 10 weeks since your last haircut at Lumen — you're due
  for one. Shall I book you in this week?").

## Recommendation rules ("Might be interested in")

Each suggestion is a product the customer has NOT bought, with a
reason tied to their history:

1. **Had colour** (Full colour or Balayage) and hasn't bought it →
   Colour-care shampoo ($28) and/or Colour-care mask ($32). The
   shampoo's reason names their most recent colour service and date.
2. **Buys shampoo** (plain or colour-care) but never conditioner →
   Conditioner (1L) ($22).
3. **Had Balayage** and never bought leave-in treatment → Leave-in
   treatment ($26).
4. **Beard trim 2+ times** and never bought beard oil → Beard oil ($14).
5. **Had colour** and never bought heat protect spray → Heat protect
   spray ($20).
6. **Fallback** — if nothing above fires: Styling gel ($16) for a
   haircut customer, otherwise Shampoo (1L) ($24).

Every one of the 12 regulars gets 2–4 suggestions from these rules.

## The sales tie-in — and why the pick is every 19th sale from index 7

The procedures are picked from the dashboard's `SALES` array using
only the sale's index: every 19th sale starting at index 7 (73 picked
sales), dealt round-robin to the 12 regulars — the first regular gets
7 visits, the rest get 6. The remaining 1,304 sales stay unattributed
walk-ins. No extra random draws, and `lib/dashboard.ts` is untouched,
so the sales generator's output and every verified dashboard figure
stay byte-identical: 1,377 sales, $72,070 total, Aug $22,615 /
Sep $24,460 / Oct $24,995.

Two choices in that derivation are deliberate, and worth knowing
before changing them:

- **Only recurring services set a due date.** The naive rule — soonest
  due date over *every* service the customer ever had — makes almost
  every regular "overdue": a beard trim's 3-week cycle lapses fast, so
  one beard trim in August would brand a customer overdue for months
  even while they visit every few weeks for haircuts. A service only
  sets a cycle when the customer had it 2+ times.
- **The stride/offset (19 / 7) was chosen for the demo mix.** Other
  strides give the same figures but a lopsided mix (e.g. 10 of 12
  overdue, or almost nobody due). 19 / 7 gives 8 regulars with a
  November booking and 4 due a nudge, with due dates spread across
  November — the mix the appointments page is built around. If you
  change the stride or offset, re-check the booked/nudge split and the
  appointment dates (all November, all Tue–Sat, no two appointments
  for the same stylist at the same time).

## How to change it

- **Edit a customer** — change their row in `ROSTER` in
  `lib/customers.ts` (name, phone, email, purchases). Their visits
  follow automatically from the sales pick.
- **Add a customer** — add a row to `ROSTER`. They get visits from
  the same round-robin pick (the pick deals to `ROSTER.length`
  customers, so counts shift by one for everyone — re-check the
  booked/nudge split after adding).
- **Change an interval** — edit `SERVICE_INTERVAL_DAYS`. Due dates,
  nudges and appointments all follow.
- **Change the nudge window** — edit `NUDGE_WITHIN_DAYS` (7 days).
- **Change a product price** — edit `RETAIL_PRODUCTS`. Purchase totals
  and recommendation prices follow.
- **Move it to Supabase later** — the same shape as the dashboard v2
  sketch in DASHBOARD.md: one table for customers, one for purchases,
  appointments as a table; the derivation functions in
  `lib/customers.ts` already take rows in and compute everything else,
  so swapping the seed rows for queries is a contained change.

## Files

| File | What it is |
|---|---|
| `lib/customers.ts` | Roster, derivation, appointments, recommendations, nudge messages |
| `app/customers/page.tsx` | Customers list (owner-gated) |
| `app/customers/[id]/page.tsx` | Customer detail (owner-gated, unknown id → 404) |
| `app/customers/loading.tsx`, `app/customers/[id]/loading.tsx` | Loading states |
| `app/appointments/page.tsx` | November diary + due-for-a-booking (owner-gated), plus the November calendar |
| `app/appointments/loading.tsx` | Loading state |
| `components/AppointmentCalendar.tsx` | November 2026 month grid (server-rendered, no client JS) |
| `components/SortableTable.tsx` | Shared sortable table used by every owner-area table |
| `components/OwnerAppointmentsCard.tsx` | Homepage Appointments card (signed-in only) |
| `components/OwnerNav.tsx` | Now also has Customers + Appointments buttons |
| `middleware.ts` | `/customers` and `/appointments` added to the guarded routes |
| `app/globals.css` | `.owner-card`, `.rec-grid` / `.rec-card`, `.nudge-box` |
| `CUSTOMERS.md` | This file |

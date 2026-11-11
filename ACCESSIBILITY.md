# Accessibility — WCAG 2.1 AA

Lumen Hair Studio (the salon demo) is built to **WCAG 2.1 AA**, the level
US Section 508 / ADA practice uses. This page records what was checked,
what was fixed, and what is still only provable on a signed-in clone.

- Normal text: 4.5:1 minimum. Large text (18pt / 24px, or 14pt / 18.66px
  bold): 3:1. Non-text UI components and focus indicators: 3:1.
- Target: WCAG 2.1 AA. Touch-target size (24px, WCAG 2.2 AA) is noted
  separately where it was improved for free — the site is not claimed
  2.2 compliant.

## What was changed (2026-11-10)

### Contrast — colours darkened just enough to pass

| Pair | Before | After | Change |
| --- | --- | --- | --- |
| White text on `--rose` (buttons, hero CTA, active tabs/filters) | 3.80:1 FAIL | 5.06:1 PASS | `--rose` #b76e79 → #a05a66 |
| Closed-day text on `#f0ebe4` (calendar) | 3.36:1 FAIL | 5.72:1 PASS | `#8a7d75` → `#6b5560` |
| `.badge-unpaid` text on `#fdf0d3` | 4.35:1 FAIL | 5.25:1 PASS | `#8a6d00` → `#7a6100` |
| P&L "Profit" chart bars on white (non-text, needs 3:1) | 2.26:1 FAIL | 4.90:1 PASS | gold `#c9a86a` → `#8a6d1f` |
| "Revenue"/"Sales tax" chart bars on white | 3.80:1 PASS | 5.06:1 PASS | rose bars now use the new `#a05a66` to match the theme |
| Input border on cream / white (non-text, needs 3:1) | 1.55:1 FAIL | 3.46:1 / 3.66:1 PASS | `#d8c7b8` → `#97826f` |
| Focus ring: navy `#1e3a5f` on plum `#3d2433` | 1.22:1 FAIL | — | Replaced by a double ring: a white outline plus a navy box-shadow, so one ring is always visible (navy on cream 10.89:1, white on plum 14.01:1) |
| Outside-month calendar day numbers (plum at 45% opacity) | 2.64:1 FAIL | 6.42:1 PASS | Opacity removed; outside days use `#6b5560` on cream |
| Stylist colours, white text (calendar blocks, dots) | Two purples + two greys, too samey | All five PASS | Reworked to five distinct dark hues: navy `#1e3a5f` 11.50:1, dark red `#7f1d1d` 10.02:1, dark teal `#0f766e` 5.47:1, dark green `#166534` 7.13:1, dark amber `#92400e` 7.09:1 |

The tag palette (people deep purple `#5b21b6` 8.98:1, money dark grey
`#374151` 10.31:1, appointments dark navy `#1e3a5f` 11.50:1, products
medium grey `#6b7280` 4.83:1, services medium purple `#7c3aed` 5.70:1)
is unchanged. The stylist colours were reworked when the filter
became multi-select: the old set (two purples, two greys) was too
samey to tell apart, so each stylist now has a clearly distinct
dark hue — Amelia dark navy `#1e3a5f` 11.50:1, Sofia dark red
`#7f1d1d` 10.02:1, Maya dark teal `#0f766e` 5.47:1, Jordan dark
green `#166534` 7.13:1, Priya dark amber `#92400e` 7.09:1 — all
passing WCAG 2.1 AA with white text. Only Amelia's navy is shared
with the tag palette (appointments); the other four are hues the
tags do not use.
The rose/plum/gold theme is unchanged in look — the rose is a touch
deeper, which is what makes the white button text pass.

### Focus and skip link

- Every focusable element now shows a clear `:focus-visible` double
  ring (white outline + navy shadow). Before, there was no `:focus`
  style at all — only the browser's default ring.
- A "Skip to main content" link is the first thing in `app/layout.tsx`
  (visible only when focused). Every `<main>` on the site carries
  `id="main-content"` so the link lands there — homepage, login,
  reset-password, update-password, leads, dashboard, admin, customers,
  customer detail, employees, employee detail, appointments.
- Placeholder text in inputs now meets contrast too
  (`::placeholder` `#6b5560`).

### Landmarks, labels and live regions

- The homepage nav is `<nav aria-label="Main">`; the owner nav is
  `<nav aria-label="Owner">` (was a plain `<div>`).
- The booking form inputs now have real `<label>`s ("Your name",
  "Phone or email", "Service", "Anything we should know? (optional)")
  instead of placeholders only. The login, reset-password,
  update-password, invite, and admin settings forms already used
  wrapping `<label>`s.
- The chat input has `aria-label="Ask the assistant"`. The chat
  message list is `role="log" aria-live="polite"` with a label, and is
  keyboard-focusable (`tabIndex={0}`) so a keyboard user can scroll
  back through the conversation. Opening the chat moves focus into
  the question box; Escape closes it and returns focus to the
  "Ask Lumen" button. The chat open button now has
  `aria-expanded` / `aria-controls`.
- Decorative emoji and arrows (✂️, 💬, →) are `aria-hidden="true"`.
- Scrollable regions are keyboard-focusable: the sortable-table wrapper
  (`.table-wrap`), the chat message list, and the admin users-table
  overflow wrapper (`role="region" aria-label="Users table"`).
- Heading order is clean everywhere (one `<h1>` per rendered page;
  the owner pages have mutually exclusive branches, so only one
  `<h1>` renders at a time). Status badges carry text, not colour
  alone. The line charts have `role="img"` + an aria-label summary,
  a labelled x- and y-axis with gridlines, and a `<title>` on every
  dot carrying its exact value (a native hover tooltip); their values
  are also in the tables above them. No per-point text label is drawn
  on the charts, so labels cannot overlap.
- The hero image has alt text ("Inside a bright, elegant hair
  studio"). It is the only content image on the site.

### Tabs, checkboxes, and the calendar

- **Dashboard tabs** (`components/DashboardTabs.tsx`) are now a real
  tab pattern: `role="tablist"` / `role="tab"` / `role="tabpanel"`,
  `aria-selected`, `aria-controls`, roving tabindex (only the active
  tab is in the Tab order), and Left / Right / Home / End arrow-key
  navigation with automatic activation. Overview is a tab too: it
  controls all ten panels.
- **Appointments views** (`components/AppointmentsView.tsx`) use the
  same tab pattern for Month / Week / Day, with a `tabpanel` around
  the calendar.
- **Stylist filter** is a native checkbox group
  (`<fieldset>` + `<legend>` + one `<input type="checkbox">` per
  stylist, labels styled as the pill buttons). Tab reaches each
  stylist and Space toggles it; the checked state is announced as
  part of the group — free, correct semantics instead of
  `aria-pressed` buttons. "All" is the select-all box: checked when
  every stylist is selected, mixed while only some are. The filter
  sits directly above the calendar, and the calendar renders inside
  one `.cal-panel` container in every view.
- **Calendar** (`components/AppointmentCalendar.tsx`): the bogus
  `role="grid"` was removed — a grid role needs row / gridcell
  children and arrow-key interaction, which this calendar does not
  have, and a grid with plain `<div>` children is worse for
  assistive tech than no role at all. The appointment links inside
  the cells are the keyboard path through the calendar. The stylist
  colour dots are `aria-hidden` (the stylist name is the link text
  right next to them).

### Reduced motion

- A `prefers-reduced-motion` media query in `app/globals.css` turns
  off the hero zoom, the fade-up section animations, smooth
  scrolling, card transitions, and the spinner animation for users
  who ask their system to reduce motion.

### Touch targets (WCAG 2.2 AA, noted separately)

- The chat close button grew from 4px 8px padding to 8px 10px.
  Everything else interactive was already 24px+.

## What was verified

- Production build passes; chatbot eval 7/7.
- All pages return 200 in dev: `/`, `/login`, `/admin`, `/leads`,
  `/dashboard`, `/customers`, `/appointments`, `/employees`,
  `/employees/maya`, `/customers/emma-thompson`,
  `/auth/reset-password`, `/auth/update-password`.
- No `useActionState` (or any React 19-only hook) in any built chunk
  (React 18.3.1 — only React 18 hooks are used anywhere).
- Contrast table above was computed with a script (relative
  luminance, WCAG ratios) over every text/background pair on the
  site; every pair now passes its threshold.
- axe-core was attempted via `npx @axe-core/cli` against the dev
  server: it did not run in this workspace (see "Known limits").

## Keyboard walkthrough (checked in code — see limits)

Tab from the top of the homepage: skip link → main nav (Services,
Book, AI assistant, owner sign-in) → hero "Book an appointment" →
services → booking form (name → phone/email → service → message →
Request booking) → chat open button → (open) question box, send,
close, Escape returns focus. On owner pages: owner nav buttons
(Dashboard, Leads, Customers, Appointments, Employees, Admin for
admins, Sign out) → dashboard tabs (one Tab stop, arrows move
between sections) → sortable headers (Enter/Space sorts, ▲/▼
announced) → appointments view tabs (arrows) → stylist checkboxes
(Tab, Space toggles) → calendar appointment links (Tab, Enter opens the
customer page) → diary links. No keyboard traps: every stop is a
native button, link, input, or checkbox; nothing captures Tab.

## Known limits — what could NOT be verified here

- **No screen reader is available in this workspace**, so the
  announcements (live region, tab selections, checkbox group) were
  verified from the markup, not heard.
- **Signed-in owner pages only show their unconfigured branch in
  this workspace** (no Supabase session here). The tab, checkbox,
  sortable-header, and calendar interactions on the configured
  branches need checking on a signed-in clone after
  `git pull origin main` + dev restart: dashboard tabs with arrow
  keys, appointments Month/Week/Day + stylist filter, a sortable
  header on /customers, the chat open/close with Escape, and the
  skip link on each owner page.
- **axe-core did not run**: `npx @axe-core/cli` against the dev
  server did not complete in this workspace (the service restarted
  while it was downloading). The contrast table + walkthrough above
  are the verification for this pass; re-running axe in a browser
  with the site open is still worth doing.
- The hero text contrast is image-dependent (white text over a photo
  with a gradient overlay) and cannot be reduced to a number; the
  bottom of the overlay is 0.88 plum, and white on plum is 14:1.

## Deliberately left out

- **Table gridlines** (`#f0e6dc` borders on `.dash-table`, `#ccc` on
  the admin table) were not darkened: they are decorative structure,
  not the boundary of a UI component, and rows are distinguished by
  their text and headers.
- **No redesign**: colours were darkened minimally and nothing was
  restyled. The public site, dashboard, and owner pages look the
  same as before, a touch deeper in the rose.
- **No changes** to business data, prices, hours, figures, routes,
  or any dashboard / customer / employee numbers.

## Fixed nav, shop, pop-ups and reviews (2026-11-11)

- **Fixed top nav** (`components/SiteNav.tsx`, `app/layout.tsx`):
  `position: fixed` with `body { padding-top: var(--nav-height) }`,
  so the bar never covers content; the variable grows on a narrow
  screen where the links wrap. It is a `<nav aria-label="Main">`
  with real links; anchor links use the `/#section` form so they
  work from any page. The skip link (z-index 100) sits above the
  nav (z-index 60) when focused, and `section { scroll-margin-top:
  80px }` keeps anchor targets clear of the bar. The dashboard's
  sticky section nav uses `top: var(--nav-height)` so it sits under
  the fixed bar, not underneath it.
- **Shop** (`/products`, `components/ShopClient.tsx`): product cards
  are plain articles with headings; the quantity picker is a labelled
  number input; the cart +/- buttons have aria-labels naming the
  product; the checkout state is announced with `role="status"`.
  The product tile is a styled initials tile, `aria-hidden`.
- **Review pop-ups** (`components/ReviewPopups.tsx`): the rotating
  text is `aria-hidden` — the same reviews are in full in the
  Reviews section, so the pop-up is a visual duplicate and must not
  interrupt screen readers. The dismiss button is outside the
  `aria-hidden` region, so it stays keyboard-reachable and
  focusable; dismissing persists in localStorage. Rotation pauses
  on hover and stops entirely under `prefers-reduced-motion` (one
  static review; the fade transition is also switched off in CSS).
- **Reviews section** (`#reviews`): the average rating is text plus
  a `role="img"` star display with an aria-label ("N out of 5
  stars"). The star rating picker is a real radio group (fieldset
  + legend, radios in DOM order 5 to 1 with row-reverse CSS so
  `input:checked ~ label` fills the chosen star and those to its
  left) — keyboard-operable with arrow keys, and the checked star
  shows the `:focus-visible` ring. Avatars are initials circles,
  `aria-hidden`, because the reviewer's name is adjacent text; the
  colours are the five WCAG-verified dark hues (white initials pass
  AA — see the avatar colours in `lib/reviews.ts`).
- **Orders** (`/orders`): the status badge reuses the lead list's
  badge styles (Paid / Pending / Cancelled), and the table sits in a
  focusable scrollable region like the other owner tables.

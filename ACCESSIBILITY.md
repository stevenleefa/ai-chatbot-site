# Accessibility — WCAG 2.1 AA

Lumen Hair Studio (the salon demo) is built to **WCAG 2.1 AA**, the level
US Section 508 / ADA practice uses. This page records what was checked,
what was fixed, and what is still only provable on a signed-in clone.

- Normal text: 4.5:1 minimum. Large text (18pt / 24px, or 14pt / 18.66px
  bold): 3:1. Non-text UI components and focus indicators: 3:1.
- Target: WCAG 2.1 AA. Touch-target size (24px, WCAG 2.2 AA) is noted
  separately where it was improved for free — the site is not claimed
  2.2 compliant.

## Dark mode (2026-11-11)

A light/dark switch sits in the fixed top nav on every page. Files:
`components/ThemeToggle.tsx` (the button, a client component),
`app/layout.tsx` (the pre-paint script), `app/globals.css` (all colours),
`components/LineChart.tsx` (chart series colours).

### How the toggle works

- The theme lives on `<html data-theme="light|dark">`. The choice is
  saved in localStorage under `lumen-theme` (same naming as the shop's
  `lumen-cart` key); with no saved choice the site follows the system
  `prefers-color-scheme`.
- **No flash of the wrong theme:** an inline blocking script in the
  layout `<head>` reads the saved choice (or the system preference)
  and sets `data-theme` before first paint. `components/ThemeToggle.tsx`
  only keeps the attribute, localStorage and the icon in sync after
  that. `<html>` carries `suppressHydrationWarning` for this one
  attribute, which the script sets before React hydrates.
- The toggle is a real `<button>` (40×40px circle, sun icon in dark
  mode, moon icon in light mode), keyboard-reachable, with an
  `aria-label` that names the action ("Switch to dark mode" /
  "Switch to light mode") and `aria-pressed`. It uses the standard
  `:focus-visible` double ring — the white inner ring is what reads
  against dark surfaces.
- Every colour goes through CSS variables in `app/globals.css`: the
  light values are the exact colours the site already used, so light
  mode is unchanged, and `:root[data-theme="dark"]` overrides them.
  The rose button gradient, the tag palette and the stylist colours
  are the same in both modes (dark hues that read on dark surfaces
  too); `--plum` flips to light in dark mode, so solid plum
  backgrounds use a separate `--plum-deep`, and rose text uses
  `--rose-text` (light `#8e4a56`, dark `#e8a7ad`). The two rules a
  variable cannot express are the hero tag's ink (gold background
  keeps its colour, the text goes dark) and the back-to-top hover
  (darkens in light, lightens in dark).
- Charts: the dashboard still passes the light hexes (`#a05a66`,
  `#8a6d1f`); `LineChart` maps them to `--chart-rose`/`--chart-gold`,
  which are the same colours in light mode and lighter variants in
  dark mode (`#e08a94`, `#d9b45b`).

### Contrast — dark-mode pairs (computed with a relative-luminance script)

Same bars as light mode: text 4.5:1, non-text UI/graphics 3:1. The
first border candidates (`#4a3642`, `#3d2c36`) failed at 1.23–1.56:1
and were lightened to `#84707d` / `#7a6672` until they reached 3:1.

| Pair | Foreground on background | Ratio | Bar |
|---|---|---|---|
| Body text on page bg | `#f2e7de` on `#221820` | 14.15:1 | 4.5:1 |
| Body text on card/surface | `#f2e7de` on `#2a1e27` | 13.14:1 | 4.5:1 |
| Body text on surface-2 (calendar panel) | `#f2e7de` on `#31242c` | 12.16:1 | 4.5:1 |
| Body text on surface-3 (table total row) | `#f2e7de` on `#372a32` | 11.21:1 | 4.5:1 |
| Input text on input bg | `#f2e7de` on `#241a21` | 13.87:1 | 4.5:1 |
| Body text on banner bg | `#f2e7de` on `#3a2f14` | 10.81:1 | 4.5:1 |
| Body text on banner-2 bg | `#f2e7de` on `#33222c` | 12.28:1 | 4.5:1 |
| Body text on closed-cell bg | `#f2e7de` on `#241a20` | 13.88:1 | 4.5:1 |
| Body text on chat user message | `#f2e7de` on `#4a2c35` | 10.14:1 | 4.5:1 |
| Body text on sage (bot msg / product tile) | `#f2e7de` on `#2e3b2e` | 9.69:1 | 4.5:1 |
| Muted text on card/surface | `#c9b8bd` on `#2a1e27` | 8.43:1 | 4.5:1 |
| Muted text on page bg | `#c9b8bd` on `#221820` | 9.08:1 | 4.5:1 |
| Placeholder/muted on input bg | `#c9b8bd` on `#241a21` | 8.90:1 | 4.5:1 |
| Muted on closed-cell bg | `#c9b8bd` on `#241a20` | 8.91:1 | 4.5:1 |
| Rose text (headings, prices, brand) on page bg | `#e8a7ad` on `#221820` | 8.66:1 | 4.5:1 |
| Rose text on card/surface | `#e8a7ad` on `#2a1e27` | 8.04:1 | 4.5:1 |
| White on rose (buttons) | `#ffffff` on `#a05a66` | 5.06:1 | 4.5:1 |
| White on rose-deep (gradient end) | `#ffffff` on `#8e4a56` | 6.43:1 | 4.5:1 |
| White on plum-deep (table th / chat head) | `#ffffff` on `#46303d` | 12.00:1 | 4.5:1 |
| White on hover rose | `#ffffff` on `#7a3f4a` | 7.96:1 | 4.5:1 |
| Badge paid text on bg | `#a8dba8` on `#1e3a24` | 7.93:1 | 4.5:1 |
| Badge unpaid text on bg | `#f0d48a` on `#3d2f10` | 8.99:1 | 4.5:1 |
| Badge overdue/low text on bg | `#f5b5ba` on `#451a1e` | 8.60:1 | 4.5:1 |
| Negative money on card | `#ff9d9d` on `#2a1e27` | 8.04:1 | 4.5:1 |
| Stars on card | `#d9b45b` on `#2a1e27` | 8.09:1 | 4.5:1 |
| Products text on card | `#b9bcc2` on `#2a1e27` | 8.40:1 | 4.5:1 |
| Hero-tag ink on gold | `#2b1a24` on `#c9a86a` | 7.28:1 | 4.5:1 |
| Chart rose line on panel | `#e08a94` on `#2a1e27` | 6.27:1 | 3:1 |
| Chart gold line on panel | `#d9b45b` on `#2a1e27` | 8.09:1 | 3:1 |
| Chart axis text on panel | `#c9b8bd` on `#2a1e27` | 8.43:1 | 4.5:1 |
| Idle star on card | `#9aa0a6` on `#2a1e27` | 6.05:1 | 3:1 |
| Input border on input bg | `#97826f` on `#241a21` | 4.61:1 | 3:1 |
| Border on card | `#84707d` on `#2a1e27` | 3.50:1 | 3:1 |
| Border on page bg | `#84707d` on `#221820` | 3.77:1 | 3:1 |
| Soft border on card | `#7a6672` on `#2a1e27` | 3.02:1 | 3:1 |

The tag palette and the stylist colours are unchanged from light mode
and pass on dark surfaces too — white text: people `#5b21b6`
8.98:1, money `#374151` 10.31:1, appointments `#1e3a5f` 11.50:1,
products `#6b7280` 4.83:1, services `#7c3aed` 5.70:1; stylists Sofia
`#7f1d1d` 10.02:1, Maya `#0f766e` 5.47:1, Jordan `#166534` 7.13:1,
Priya `#92400e` 7.09:1 (Amelia `#1e3a5f` 11.50:1, same as appointments).

Dark rendering cannot be clicked in this workspace (no browser here),
so the visual proof — toggle, system-default behaviour, charts,
pop-ups and chat in dark, and no light-mode regressions — still needs
a signed-in clone.

### Header colour switcher (temporary, 2026-11-12)

The fixed top nav used to be the page colour (`--cream`) with no
vertical padding, so it did not read as a bar and the theme-toggle
icon touched its top and bottom edges. A temporary segmented control
(`components/HeaderColorSwitcher.tsx`, three swatches next to the
theme toggle) switches the header between deep plum, rose and gold
live, so the owner can pick a winner; it saves the choice in
localStorage (`lumen-header`, default plum) and a pre-paint script in
`app/layout.tsx` applies it before first paint, mirroring the theme
script. Once a winner is picked, the switcher is deleted, the winner
is hardcoded as `--nav-bg`/`--nav-fg`, and the `data-header`
attribute + script go away. The nav inner also gained 12px of
top/bottom padding (was `0 24px`); the height is measured by
`NavHeight.tsx`, so body padding-top follows automatically, and no
min-height was added to the header. The brand, nav links and the
signed-out "Owner sign in" link all use `--nav-fg`; link hover keeps
the underline and does not change colour.

| Pair | Foreground on background | Ratio | Bar |
|---|---|---|---|
| Cream on plum header | `#fdf8f1` on `#3d2433` | 13.26:1 | 4.5:1 |
| White on rose header | `#ffffff` on `#a05a66` | 5.06:1 | 4.5:1 |
| Plum on gold header | `#3d2433` on `#c9a86a` | 6.20:1 | 4.5:1 |

The three pairs are identical in light and dark mode (the same
`--nav-bg`/`--nav-fg` values in both) and were computed with a
relative-luminance script. The header also reads as a band against
the page in both modes, though the dark-mode plum band is subtle
(plum on the dark page is 1.23:1 — it reads through the hue
difference plus the border below the header; rose is 3.40:1 and gold
7.62:1 there). The switcher itself is three real `<button>`s with
`aria-pressed` and an `aria-label` naming the colour, in a
`role="group"` labelled "Header colour".

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
  the fixed bar, not underneath it — and since 2026-11-11 that
  variable is measured in the browser by `components/NavHeight.tsx`
  (the nav wraps to two rows at most widths, so a fixed 64px used
  to put the tabs 44px too high, hidden under the bar). The tab
  row also carries a matching `scroll-margin-top`, so clicking a
  tab scrolls it into view just below the bar.
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
  focusable; dismissing hides the pop-ups for this page load only
  — a refresh brings them back (the old localStorage persistence
  was removed 2026-11-11 at the owner's request). Rotation pauses
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
- **Back to top** (`components/BackToTop.tsx`, in `app/layout.tsx`):
  a real `<button>` with an "Back to top" aria-label, so it is in
  the Tab order and announces itself; it only renders on a page
  longer than one screen once you have scrolled down, so short
  pages never show it. It smooth-scrolls to the top, or jumps
  straight there under `prefers-reduced-motion`. It sits at the
  bottom centre so it never covers the chat widget (bottom-right)
  or the review pop-ups (bottom-left).

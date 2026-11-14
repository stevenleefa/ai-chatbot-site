# Personalisation — Lumen Hair Studio

A signed-in customer can make the site their own from **/my-account →
Display settings**: a colour theme, a font pairing, a text size and
three accessibility options. The choice applies across the whole site
the moment it is picked, and it works for signed-out visitors too
(localStorage only — the settings panel itself lives on /my-account,
but the provider + pre-paint script apply the saved choice on every
page).

This is **not** a revival of the old header-colour switcher (removed
2026-11-12, colours hardcoded to plum light / rose dark). Plum/rose
is still the default: a customer who never picks anything sees exactly
the site they saw before this change.

## The 5 colour themes

Each theme changes the header (`--nav-bg` / `--nav-fg`), the accent
(`--rose` / `--rose-deep` / `--rose-text`) and the button gradient
(including the hover end, `--rose-hover`). Every theme is defined for
both light and dark mode. All ratios below were computed with the
relative-luminance function in `lib/personalization.ts`
(`contrastRatio`) and are re-asserted in
`__tests__/personalization.test.ts` — every key pair is ≥ 4.5:1
(WCAG 2.1 AA, normal text).

| Theme | Accent / deep / hover | Header light (cream text) | Header dark (white text) | Accent text on page |
|---|---|---|---|---|
| **Plum** (default) | `#a05a66` 5.06:1 / `#8e4a56` 6.43:1 / `#7a3f4a` 7.96:1 | `#3d2433` 13.26:1 | `#a05a66` 5.06:1 | light `#8e4a56` 6.09:1, dark `#e8a7ad` 8.66:1 |
| **Rose** | `#9c3d54` 6.54:1 / `#7f2d40` 8.93:1 / `#6b2436` 10.88:1 | `#4a1524` 13.96:1 | `#9c3d54` 6.54:1 | light `#7f2d40` 8.45:1, dark `#f9a8d4` 9.50:1 |
| **Teal** | `#0f766e` 5.47:1 / `#0b5a53` 8.07:1 / `#084c46` 9.85:1 | `#0b3d3a` 11.40:1 | `#0f766e` 5.47:1 | light `#0b5a53` 7.64:1, dark `#7dd3c8` 9.86:1 |
| **Forest** | `#166534` 7.13:1 / `#14532d` 9.11:1 / `#0f3d21` 12.28:1 | `#0f2e1d` 13.91:1 | `#166534` 7.13:1 | light `#14532d` 8.62:1, dark `#86efac` 12.26:1 |
| **Navy** | `#1e3a5f` 11.50:1 / `#172c49` 14.07:1 / `#12263f` 15.28:1 | `#101f33` 15.70:1 | `#1e3a5f` 11.50:1 | light `#172c49` 13.31:1, dark `#93c5fd` 9.55:1 |

"White on accent/deep/hover" is the button text; "header" is the
fixed top nav; "accent text on page" is `--rose-text` (headings,
prices, links) on the light page (`#fdf8f1`) and the dark page
(`#221820`). The chat head, table headers and back-to-top button
(`--plum-deep`) follow the theme too, and the chart rose series
(`--chart-rose`) uses the accent in light mode and the light accent
text in dark mode.

## Fonts, sizes and accessibility

- **Font pairings** — only fonts the site already loads (Playfair
  Display + Inter, via `next/font` in `app/layout.tsx`) plus system
  fonts; no new font load was added.
  - *Classic* (default): Playfair Display headings, Inter body.
  - *Clean*: Inter for headings and body.
  - *Readable*: Georgia serif headings, system sans body.
- **Text size** — Small / Medium / Large. Medium is the site as it
  is (16px body, 34px section headings, 14px buttons). Small is
  ~0.9× (15px / 30px / 13px), Large ~1.15× (18px / 39px / 16px).
  The site uses px in many places, so a root font-size change alone
  would scale almost nothing — the sizes are targeted rules in
  `app/globals.css` instead. **What scales:** body text, section
  headings, buttons, form inputs, the brand, hero text and dashboard
  tables. **What does not scale:** the hero h1 (`clamp()` px), chat
  messages, review stars, badges and the small muted notes — they
  keep their px sizes.
- **Larger text** — a stronger boost on top of the size choice
  (19px body, 40px headings, 1.7 line-height). When both are set,
  the larger-text sizes win on the same elements.
- **High contrast** — darker body text (`#1a0f16` light / white dark)
  and muted text, stronger borders and input borders, a thicker
  focus ring and 2px card borders, in both light and dark mode.
  The accent text is not touched: every theme's accent text already
  passes 4.5:1 on its page background.
- **Reduce motion** — turns off the hero zoom, fade-up entrances,
  card transitions, smooth scrolling, the spinner and the review
  pop-up fade, **in addition to** the existing
  `prefers-reduced-motion` media query — so a customer who asks for
  it gets it even if their OS does not.

All controls are real radio inputs / checkboxes with labels, so the
panel works by keyboard alone; the selected theme swatch is a checked
radio, so it is announced.

## How persistence works

- **On the device (always):** `localStorage` key `lumen-preferences`
  (JSON). Written on every change, read on every page load.
- **On the account (when signed in + Supabase set up):** the
  `customer_preferences` table (one row per `auth.users` id), via
  `GET` / `POST /api/preferences`. GET returns the account copy when
  there is one (it wins over the device copy and is written back to
  localStorage), the defaults when there is no row, and
  `{ configured: false }` when Supabase is unconfigured. POST
  validates every field against the allowlists in
  `lib/personalization.ts` (unknown theme/font/size → 400), takes
  the user id from the verified session only, and is body-capped +
  rate-limited (10/min) like the other API routes. 401 when not
  signed in.
- **Signed out / unconfigured:** the panel still works on localStorage
  and says "Saved on this device only".

## Setup (user step)

Run `supabase/customer-preferences-schema.sql` **once** in the
Supabase SQL Editor of the ai-leads project (same project as the
leads table). It creates the `customer_preferences` table with RLS
ON and NO public policies (service-role only, same pattern as
`saved-carts-schema.sql`). Until it has run, preferences stay on the
device only — nothing breaks, they just don't follow the customer
across devices.

## Layout wiring (for the coordinator — NOT done by this change)

`app/layout.tsx` was deliberately not edited (the voice/tour work
owns it in parallel). After that lands, add exactly these lines:

1. Import, next to the other component imports:
   `import PersonalizationProvider, { PersonalizationScript } from "@/components/PersonalizationProvider";`
2. Inside `<head>`, next to the existing theme script:
   `<PersonalizationScript />`
3. Inside `<body>`, next to the other mounted components (e.g. after `<NavHeight />`):
   `<PersonalizationProvider />`

The provider renders no UI; it reads localStorage on mount and
applies the saved preferences to `<html>`. The pre-paint script
reads the same key before first paint and sets the same data
attributes, so there is no flash of the default theme — mirroring
the existing dark-mode pre-paint script.

## Files

| File | What it does |
|---|---|
| `lib/personalization.ts` | Themes + ratios, font/size options, validation (lenient parse + strict API check), localStorage helpers, `applyPreferences`, the pre-paint script string. Pure + client-safe. |
| `components/PersonalizationSettings.tsx` | The settings panel (radios + checkboxes, immediate apply + save). |
| `components/PersonalizationProvider.tsx` | Mount-time applier (no UI) + `PersonalizationScript` for `<head>`. |
| `app/api/preferences/route.ts` | GET / POST, session user id only, strict validation, rate-limited. |
| `supabase/customer-preferences-schema.sql` | The table (run once — see above). |
| `app/my-account/page.tsx` | "Display settings" section rendering the panel. |
| `app/globals.css` | Theme variables per theme/mode, font/size/accessibility rules, panel styles; button hover ends now use `--rose-hover` so they follow the theme. |
| `__tests__/personalization.test.ts` | Contrast re-computation, validation, font-size values, storage helpers. |
| `__tests__/PersonalizationSettings.test.tsx` | Panel behaviour (apply + persist, signed-out shape). |

## How to test (on the clone)

- Pick each theme in /my-account → Display settings: header,
  buttons and accent text change at once, in both light and dark
  mode; reload and the choice is still there.
- Fonts: Clean makes headings Inter; Readable makes them Georgia.
  Sizes: Small shrinks and Large grows body text, headings, buttons
  and inputs (hero h1 and chat text stay put — see above).
- Accessibility: Larger text grows text further; High contrast
  darkens text and strengthens borders; Reduce motion stops the hero
  zoom and card transitions even with the OS set to full motion.
- Keyboard: Tab through the panel — every swatch, radio and checkbox
  is reachable and the focus ring is visible.
- Account sync: sign in on a second device (after running the SQL)
  — the theme picked on the first device is already applied.

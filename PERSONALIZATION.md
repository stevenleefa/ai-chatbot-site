# Personalisation — Lumen Hair Studio

A signed-in customer can make the site their own from **Settings**
(hamburger menu → Settings, or `/settings`): a colour theme, a font
pairing, a text size and three accessibility options, plus their
preferred stylist, email notifications and favorite products. The
choice applies across the whole site the moment it is picked, and it
works for signed-out visitors too (localStorage only — the settings
panel itself lives on /settings, but the provider + pre-paint script
apply the saved choice on every page).

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
  is (16px root, the browser default). Small is 15px root (~0.94×),
  Large is 18px root (~1.13×). The size sets the root font-size on
  `<html>` and every text size in `app/globals.css` is in `rem`, so
  the size scales **everywhere** — body, headings, buttons, form
  inputs, the brand, hero text (including the h1 `clamp()`),
  dashboard tables, chat messages, review stars, badges, the small
  muted notes, the hamburger menu and the nav. Because the sizes
  are `rem`, the Medium rendering is unchanged (1rem is 16px).
  The chart axis labels (`components/LineChart.tsx`, SVG
  presentation attributes) are the only text that does not scale —
  they are data labels, not body text.
- **Browser chrome colour** — the `<meta name="theme-color">` tag
  follows the theme: it is the theme's header background
  (`--nav-bg`) for the current light/dark mode, so the browser's
  tab/address bar tints to match the header (Safari tab bar,
  mobile Safari/Chrome address bar). It updates whenever the theme
  or the light/dark mode changes, and before first paint, so the
  chrome never shows the wrong colour on load. It is a hint —
  browsers may tint the chrome but desktop behaviour varies, and
  it never recolours the whole browser window.
- **Larger text** — a stronger boost on top of the size choice
  (19px root, 1.7 line-height). When both are set, the larger-text
  root wins.
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

## Voice

The assistant's spoken voice — a **Voice** section in the same
Display settings panel, with three controls:

- **Voice** — a dropdown of the voices this browser offers
  (`speechSynthesis.getVoices()`), each shown as its name and
  language (e.g. "Samantha — en-US"). The choice is stored by the
  voice's `voiceURI` (or its name, when the voice has no `voiceURI`);
  "Default voice" stores nothing and the browser default speaks.
  The list loads asynchronously — `getVoices()` may return empty
  on first call, so the panel listens for the `voiceschanged`
  event and fills the dropdown when the voices arrive. Where
  speech synthesis is unsupported, the picker is replaced by a
  note ("Voice options aren't available in this browser") and the
  text chat keeps working.
- **Speed** — Slow / Normal / Fast (rate 0.75 / 1 / 1.25).
- **Pitch** — Low / Normal / High (pitch 0.75 / 1 / 1.25).
- **Hear a preview** — speaks a short sample sentence with the
  voice, speed and pitch currently chosen, so the customer hears
  the difference at once.

The next spoken reply uses the new settings — the chat reads them
fresh from localStorage every time it speaks, so a change made on
/settings applies at once even while the chat is open. The
speaker toggle, the spoken-reply behaviour and the text fallback
are unchanged; listening (speech-to-text) is untouched.

**Browser differences, and the fallback.** The voice list depends
on the browser and the operating system: Safari on a Mac has its
own set of voices, Chrome has Google voices, and a phone has
different voices again. A voice picked on one device may not
exist on another — when the saved voice is not in this browser's
list, the panel says so ("Your saved voice isn't available on
this device — using the default voice instead") and the assistant
speaks with the first English voice (or the browser default). It
never errors, and the stored choice is kept, so it comes back if
the customer returns to a device that has it. Rate and pitch are
validated to the range 0.5–2 server-side (see below); the panel
only offers the three steps, but the API accepts any number in
range.

## Preferred stylist & email notifications

Two more sections in the same Settings panel, saved the same way
(localStorage + the `customer_preferences` row — see below):

- **Preferred stylist** — a dropdown with the five stylists
  (Amelia Brooks, Sofia Reyes, Maya Chen, Jordan Lee, Priya Nair)
  plus "No preference". It is saved only: booking does not use it
  yet — a later step will offer the preferred stylist first in the
  booking form. An unknown name is rejected with 400, like the
  other fields.
- **Email notifications** — one checkbox, "Email me about
  appointments and offers". It is a **preference only**: the site
  does not send reminder or marketing emails yet — the only emails
  it sends are Supabase Auth invites and password resets, via
  Yahoo SMTP. Turning it off records that the customer does not
  want those emails, so the sending flow (when it is built) can
  respect it from day one. Default on.

## Favorite products

Favorites live on the same Settings page, under their own heading,
and on the shop: every product card has a heart button ("♡
Favorite" / "♥ Favorited"). A signed-in customer favorites from
either place; a signed-out visitor tapping a heart in the shop is
prompted to sign in (with a link) instead of failing silently.

Favorites are a many-to-many (one customer, many products; one
product, many customers), so they live in their own table,
`user_favorites` (`user_id`, `product_id`, `created_at`) — not an
array column on the preferences row. The API is `GET` / `POST` /
`DELETE /api/favorites` (POST and DELETE take `{ productId }` and
answer with the updated id list, so the client never re-fetches);
product ids are validated against the catalogue in
`lib/products.ts` (unknown id → 400), everything is keyed by the
verified session user id, and the route is body-capped +
rate-limited (10/min) like the other API routes. RLS is on with
no public policies (service-role only). The Settings list shows
each favorite's photo, name and price (sale price when on sale)
with a Remove button, plus an "Add a favorite product" dropdown
of the products not yet favorited; a product removed from the shop
since it was favorited simply does not render.

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

For the voice options, also run
`supabase/customer-preferences-voice.sql` **once** in the same SQL
Editor. It only adds three columns (`voice_uri`, `voice_rate`,
`voice_pitch`) to the existing table — safe to run again
(`IF NOT EXISTS`), no data is changed, and RLS stays on. Until it
has run, the voice choice stays on the device only (the theme,
font and size sync is unaffected).

For the Settings page fields, also run
`supabase/customer-preferences-settings.sql` **once** in the same
SQL Editor. It only adds two columns (`preferred_stylist`,
`email_notifications`) — safe to run again (`IF NOT EXISTS`), no
data is changed, and RLS stays on. And run
`supabase/user-favorites-schema.sql` **once** to create the
`user_favorites` table (RLS on, no public policies). Until these
have run, the stylist/notification choices stay on the device only
and favorites say they aren't set up yet — nothing breaks.

Note the order does not matter (both migrations are `IF NOT
EXISTS`), but **run both preference migrations together**: until
both the voice columns and the settings columns exist, `POST
/api/preferences` fails on the missing column and the account sync
falls back to on-device only for every field — the settings still
work, they just do not follow the account across devices yet.

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
| `lib/personalization.ts` | Themes + ratios, font/size options, voice options (rate/pitch steps + range), validation (lenient parse + strict API check), localStorage helpers, `applyPreferences`, the pre-paint script string, and the browser chrome colour (`themeColorFor` + `syncThemeColorMeta`). Pure + client-safe. |
| `components/PersonalizationSettings.tsx` | The settings panel (radios + checkboxes + selects, immediate apply + save), including the Voice section (voice dropdown from `getVoices()`, speed/pitch selects, Hear a preview), the Preferred stylist dropdown and the Email notifications checkbox. |
| `app/settings/page.tsx` | The Settings page (signed-in only): the panel above + the Favorite products section. Linked from the hamburger menu. |
| `lib/favorites.ts` | Favorite-product helpers (server-only): list/add/remove by session user id, product ids validated against the catalogue. |
| `app/api/favorites/route.ts` | GET / POST / DELETE for favorites, session user id only, rate-limited. |
| `components/FavoriteProducts.tsx` | The Favorite products section on /settings (list with photo/price/Remove, add from a dropdown). |
| `components/ShopClient.tsx` | The shop; each product card has a heart toggle (signed-out visitors are prompted to sign in). |
| `components/HamburgerMenu.tsx` | The menu; signed-in users get a Settings link (after My account / Profile). |
| `supabase/customer-preferences-settings.sql` | Adds the two settings columns (run once — see above). |
| `supabase/user-favorites-schema.sql` | Creates the `user_favorites` table (run once — see above). |
| `app/my-account/page.tsx` | No longer renders the settings panel — that lives on /settings now; still profile + bookings + orders + referral + repurchase + saved carts. |
| `components/PersonalizationProvider.tsx` | Mount-time applier (no UI) + `PersonalizationScript` for `<head>`; watches `data-theme` so the chrome colour follows dark/light toggles too. |
| `components/GuidedTour.tsx` | Six-step tour; highlights each step's target (`tour-highlight` outline) and sets `data-tour-active` on `<body>` while showing, which hides the review pop-ups. |
| `lib/speech.ts` | Web Speech helpers; `findVoiceByUri` (voiceURI, then name, then null) and `applyVoiceSettings` (chosen voice or first English voice, rate/pitch clamped to 0.5–2). |
| `components/ChatWidget.tsx` | The chat; `speak()` reads the stored voice choices fresh each reply and applies them via `applyVoiceSettings`. |
| `app/api/preferences/route.ts` | GET / POST, session user id only, strict validation, rate-limited. |
| `supabase/customer-preferences-schema.sql` | The table (run once — see above). |
| `supabase/customer-preferences-voice.sql` | Adds the three voice columns (run once — see above). |
| `app/globals.css` | Theme variables per theme/mode, font/size/accessibility rules, panel styles; button hover ends now use `--rose-hover` so they follow the theme. |
| `__tests__/personalization.test.ts` | Contrast re-computation, validation, font-size values, storage helpers, stylist list agreement with the dashboard. |
| `__tests__/PersonalizationSettings.test.tsx` | Panel behaviour (apply + persist, signed-out shape, voice, stylist, notifications). |
| `__tests__/favorites.test.ts` | Favorite-product id validation + the server helpers' unconfigured/unknown-id behaviour. |
| `__tests__/favorites-routes.test.ts` | /api/favorites guards (401, 503, 400 unknown id) with mocked session/supabase. |
| `__tests__/FavoriteProducts.test.tsx` | The favorites section (list, remove, add from the dropdown). |
| `__tests__/speech.test.ts` | Speech helpers: feature detection, markdown stripping, voice resolution (by URI/name, fallback, clamping). |

## How to test (on the clone)

- Settings page: hamburger menu → Settings (signed in, as a
  customer or staff). Signed out, /settings sends you to the
  customer sign-in. /my-account no longer shows Display settings.
- Pick each theme in Settings: header, buttons and accent text
  change at once, in both light and dark mode; reload and the choice
  is still there.
- Fonts: Clean makes headings Inter; Readable makes them Georgia.
  Sizes: Small shrinks and Large grows **all** text on the site —
  body, headings, buttons, inputs, chat messages, badges, the
  menu and the nav (the hero h1 and chat text scale now too).
- Browser chrome: the tab/address bar tints to the theme's header
  colour in light and dark mode; switching theme or dark mode
  re-tints it at once.
- Accessibility: Larger text grows text further; High contrast
  darkens text and strengthens borders; Reduce motion stops the hero
  zoom and card transitions even with the OS set to full motion.
- Voice: in Settings → Voice, pick a voice, a speed and
  a pitch, then "Hear a preview" — the sample speaks with the
  chosen settings. Ask the chat a question and the reply speaks
  with them too. Change the voice on one device and the choice
  follows the account (after running the voice SQL); pick a voice
  on a Mac and open the site on a device that doesn't have it and
  the panel says so and the default voice speaks.
- Preferred stylist: pick one in Settings — reload and it is still
  picked; "No preference" clears it. (Booking doesn't use it yet.)
- Email notifications: the checkbox is on by default; turn it off
  and reload and it stays off. Nothing is emailed either way yet —
  this only records the preference.
- Favorite products: tap the heart on a product in the shop — it
  becomes "♥ Favorited" and the product appears under Favorite
  products in Settings; Remove there takes it off, and the heart in
  the shop follows. Signed out, tapping a heart says to sign in
  (with a link) instead of doing nothing. After running the
  favorites SQL, favorites follow the account; before that, the
  section says they aren't set up yet.
- Keyboard: Tab through the panel — every swatch, radio, checkbox
  and select is reachable and the focus ring is visible.
- Account sync: sign in on a second device (after running the SQL)
  — the theme picked on the first device is already applied.

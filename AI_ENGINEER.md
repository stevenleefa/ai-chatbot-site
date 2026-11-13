# AI Engineer track — tools, prompts, evals, observability

The chatbot is no longer just grounded Q&A. It is an AI-engineered
assistant: it can **look things up and do things** (tools), its
wording is **versioned code** (prompts), its behaviour is **tested by
evals** (not vibes), and every turn is **logged** (observability).
Free mode works with no API key and no network calls to OpenAI.

## The two paths, one contract

| | Free mode (default) | OpenAI mode |
|---|---|---|
| Trigger | No `OPENAI_API_KEY` | Key set in `.env.local` |
| Understanding | `lib/intent.ts` — deterministic regexes | gpt-4o-mini with real function calling |
| Tools | Same `lib/tools.ts` functions | Same functions, exposed as OpenAI tools |
| Answer shape | `{ answer, sources, grounded, mode, promptVersion, action? }` | Identical |

The response shape is the same either way, so the widget, the
evals and the logs do not care which mode answered.

## Tools (`lib/tools.ts`)

| Tool | Reads from | What it does |
|---|---|---|
| `getServices` | `lib/business.ts` | The 4 services with prices/times, plus hours and phone. |
| `getAvailability` | `lib/customers.ts` diary | Free slots per stylist on a day. The diary covers **November 2026 only**; Sundays are closed. |
| `createBooking` | `saveLead()` in `lib/leads.ts` | Validates everything server-side, then saves via the **same lead-save path as the booking form** — including the 60-second duplicate protection — and fires the same two automation events (`lead.created`, `appointment.booked`). |
| `searchProducts` | `lib/products.ts` | The catalogue by name/category/keyword, with real prices incl. sale prices (see the Voice assistant + guided tour section below). |
| `recommendProduct` | `lib/products.ts` | One in-stock product for a stated need, with a one-line reason from its description. |
| `addToCart` | `lib/products.ts` | Validates server-side (exists, active, in stock, quantity 1–99) and returns the `{ action: "addToCart", productId, quantity }` action the widget writes to the `lumen-cart` cart. |

Validation rules (all server-side, both modes):

- Service must be one of Haircut / Full colour / Balayage / Beard
  trim. A bare "colour" means Full colour; balayage needs its word.
- Name and contact are required (≤ 100 chars); contact must look
  like a phone number or email (contains a digit or `@`).
- Date must be in November 2026 and an open day (Mon–Sat).
- Time must be a diary slot: 09:00, 10:30, 12:00, 13:30, 15:00, 16:30.
- Stylist must be one of Amelia Brooks, Sofia Reyes, Maya Chen,
  Jordan Lee. **Priya Nair is the receptionist** — she has no
  appointments and cannot be booked; the tools say so honestly.
- A clash (stylist already booked at that time) fails with the
  names of the stylists who *are* free then.
- No stylist given: first stylist (alphabetical) with the slot free.

A booking is a **request**, never a confirmation: the reply says
the studio will confirm shortly, and in demo mode (Supabase
unconfigured) it says honestly that the request was not saved yet
(`saved: false` in the action).

The action object is the contract (`ChatAction` in `lib/tools.ts`):
`booking_created` / `booking_failed` / `booking_needs_details` /
`availability` / `availability_failed` / `services`. The widget
renders `booking_created` and `availability` as a one-line summary
under the reply.

## Prompts (`lib/prompts.ts`)

- `CHAT_PROMPT_VERSION` — currently `lumen-chat-v1`. Bump it
  whenever the wording changes, and note the change here.
- `CHAT_SYSTEM_PROMPT` — the grounding contract: answer only from
  context and tool results, never invent prices/hours/services,
  bookings need all five details, never claim a booking is
  confirmed.
- `CHAT_FALLBACK` — the grounded refusal ("I don't have that
  information…"), used when no chunk matches and no tool applies.

No prompt text lives in the route handler.

## Free-mode intent parser (`lib/intent.ts`)

Deterministic regexes, no LLM. It recognises booking and
availability; everything else falls through to retrieval. Two
guard cases are pinned by tests:

- **"How do I book an appointment?" is a question, not a booking**
  — it is answered from the booking chunk (phone number).
- **"What are your opening hours?" is not an availability check**
  — availability needs a day *and* an availability word, so
  "Are you open on Sundays?" correctly becomes a check for the
  next Sunday (closed).

Dates resolve against the demo "today", 2026-10-31: "Saturday"
means 7 Nov, "tomorrow" means 1 Nov. Times: "3pm" → 15:00,
"10:30" → 10:30.

## Evals (`scripts/eval.mjs`)

16 cases, all run in **free mode** (no API key): the original 7
plus 4 tool cases — a booking creates a booking (action
`booking_created`), an availability question returns real slots
(action `availability`), a bare "Book a haircut" asks for the
missing details (`booking_needs_details`), and a Sunday booking
fails honestly (`booking_failed`, "closed") — plus 5 product
cases: a product price question answered with the real sale price
(Colour-care shampoo $23.80, action `products`), a product
recommendation (Colour-care mask for coloured hair), a successful
add to cart (action `cart_added`), an out-of-stock add refused
(hair oil, action `cart_failed`), and a service question still
answered from the business data (balayage $110). Run with
`npm run eval` against a dev server. CI runs it on every push.

## Observability

Every turn logs one JSON line to the console, e.g.:

```json
{"ts":"2026-11-11T20:00:00.000Z","route":"/api/chat","promptVersion":"lumen-chat-v1","mode":"free","intent":"booking","tool":"createBooking","chunks":["booking"],"outcome":"booking_created","latencyMs":42}
```

Fields: timestamp, route, prompt version, mode, intent kind, tool
name (or null), retrieved chunk ids, outcome, latency in ms.
**No personal data is ever logged** — no names, phones or emails.
In production, ship these lines to a log aggregator and alert on
`outcome: "booking_failed"` spikes or latency outliers.

## Voice assistant + guided tour (2026-11-13)

### Voice assistant (components/ChatWidget.tsx, lib/speech.ts)

- **Greeting by name.** `app/layout.tsx` (server) reads the session
  and passes the display name to the widget as a `displayName`
  prop, so a signed-in customer hears "Hi \<Name\> — how can I
  help?"; signed out, the generic greeting. The name comes from
  the server session only, never from client input. The greeting
  also mentions the guided tour (menu), but never starts it.
- **Speak (text-to-speech).** The assistant speaks its replies
  with the browser Web Speech API (`window.speechSynthesis`).
  A speaker toggle in the chat header (real `<button>`,
  `aria-pressed`) is on by default where speech is supported and
  hidden where it is not. Only the assistant's reply text is
  spoken, with markdown stripped (`stripMarkdownForSpeech` in
  `lib/speech.ts`); voices are warmed on `voiceschanged`, an
  English voice is preferred when one exists, and in-progress
  speech is cancelled when the chat closes, speaking is toggled
  off, or a new reply starts.
- **Listen (speech-to-text).** A microphone button in the input
  row uses `window.SpeechRecognition ||
  window.webkitSpeechRecognition`. While listening it shows a
  "Listening…" state (`role="status"`); a second tap or Escape
  stops it (Escape stops the mic first, a second Escape closes
  the chat). Interim results show live in the question box; a
  final result is sent straight away. On error, no permission, or
  an unsupported browser it shows "Voice input isn't available in
  this browser — type instead." and the text chat keeps working.
  Everything is feature-detected — the buttons simply do not
  render where the APIs are absent (jsdom included). Safari's
  speech recognition is limited, so the text fallback is the
  requirement, not an afterthought.
- **What still needs a real browser:** the mic, the spoken voice,
  and the toggle behaviour — none of that can be heard or clicked
  in this workspace; try it on a signed-in clone.

### Product tools (lib/tools.ts)

| Tool | Reads from | What it does |
|---|---|---|
| `searchProducts` | `lib/products.ts` | Search the catalogue by name/category/keyword (name matches count most, max 5). Returns real prices incl. sale prices via `getSalePriceCents` — e.g. Colour-care shampoo is $23.80 (was $28.00, 15% off). No match is an empty list, and the route falls through to the grounded refusal. |
| `recommendProduct` | `lib/products.ts` | Recommend one product for a stated need (coloured/dry hair, beard, frizz, heat, gift, scalp, volume, hold) with a one-line reason tied to the product's description. Only in-stock, active products are ever recommended — if the best match is out of stock (scalp scrub), the reason says so and names the closest in-stock pick. |
| `addToCart` | `lib/products.ts` | Validates server-side — product exists, is active, is in stock, quantity is an integer 1–99 — and returns the structured action `{ action: "addToCart", productId, quantity }`. It does NOT write localStorage itself (server code cannot); the widget applies it to the `lumen-cart` cart, re-validating against the catalogue first (`lib/chat-cart.ts`), and shows "Added \<name\> × \<qty\> to your cart — view it on the shop page." An out-of-stock or inactive product is refused with a plain message, never added. |

Free mode runs the same tools via `parseProductIntent` in
`lib/tools.ts` (product names, "add … to cart", "recommend …
for …"); it never hijacks service questions — "Do you do beard
trims?" still reaches retrieval ($15). The versioned prompt is
still `lumen-chat-v1` (not bumped: the contract is extended, not
broken) — it now names the product tools and the rule that every
product price must come from a tool result, sale price included.

### Guided tour (components/GuidedTour.tsx, lib/tour.ts)

Five steps, started only from the hamburger menu ("Take a guided
tour") — it never auto-starts: (1) Services & prices (`/#services`),
(2) How to book (`/#booking`), (3) The shop (`/products`),
(4) Your account (`/my-account`), (5) Refer a friend
(`/my-account`, scrolled to the referral heading). Each step
navigates, scrolls its target into view, and shows a tooltip card
(title, one or two lines, Back / Next / Skip tour, "Step X of 5").
The tooltip is a real `role="dialog"` region, focus moves into it
on each step, Escape closes it and returns focus to the hamburger
button, and it honours `prefers-reduced-motion` (no smooth
scrolling). Progress is saved in localStorage (`lumen-tour`,
`{ completed, finished }`): closing mid-tour saves the steps
done but never marks it finished, so the menu offers "Resume
tour" at the next unfinished step; a finished tour offers
"Restart tour". Styled inline with the existing CSS variables, so
it follows light/dark mode with no new CSS. What still needs a
clone: the tour visually — the tooltip position, the cross-page
scrolling, and the referral step landing on the referral section.

## Trying OpenAI mode (on your Mac)

In Terminal, in the salon folder:

```bash
# in .env.local — never commit this file, never paste the key in chat
OPENAI_API_KEY=sk-...
```

Then restart the dev server and chat: ask "Book a balayage for
Grace Liu, grace.liu@example.com, on 2026-11-21 at 10:30" and watch
the model call `createBooking` itself. If the model asks for a
missing detail, that is the tool contract working — give it the
detail and it will book. Remove the key (or leave it unset) to go
back to free mode; the answers stay the same shape.

## What this does NOT do

- No real emails or messages are ever sent — a booking is a saved
  lead; the studio confirms it.
- No prices, hours or availability are ever invented: tools and
  retrieval are the only sources, in both modes.
- No prompt text is hidden in route handlers; no tool bypasses
  server-side validation, even when the model calls it.

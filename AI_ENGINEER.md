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

11 cases, all run in **free mode** (no API key): the original 7
plus 4 tool cases — a booking creates a booking (action
`booking_created`), an availability question returns real slots
(action `availability`), a bare "Book a haircut" asks for the
missing details (`booking_needs_details`), and a Sunday booking
fails honestly (`booking_failed`, "closed"). Run with `npm run eval`
against a dev server. CI runs it on every push.

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

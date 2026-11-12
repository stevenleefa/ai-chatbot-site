# Automations — AI workflows with n8n

The salon site emits an event whenever something worth automating
happens — a new lead, a booking, a review — and **n8n** turns it into
a draft the owner reviews. This is the AI Workflow / Automation
Engineer track: the app is the system of record, n8n is the
workflow layer, and a human stays in the loop.

**Nothing here ever messages a real customer by itself.** Every
workflow ends in a Set node that shapes a **draft**. The draft lives
in n8n's Executions view for the owner to read, edit and send
themselves. There is deliberately no email / SMS / WhatsApp node in
any workflow in this repo.

## How it fits together

```
Visitor books / reviews
  -> Next.js API route (/api/lead, /api/reviews)
  -> lib/events.ts POSTs { type, ...fields } to N8N_WEBHOOK_URL/<type>
  -> n8n Webhook node (one path per event type)
  -> OpenAI node drafts the message (owner's own key, see below)
  -> Set node shapes the draft -> owner reviews it in n8n Executions
```

Events (see `lib/events.ts` — the payload is an explicit allow-list,
no secrets, no tokens):

| Event | Fired from | Payload fields |
|---|---|---|
| `lead.created` | `app/api/lead/route.ts`, after a booking request is accepted | name, contact, service, message?, saved |
| `appointment.booked` | same route, same moment — one booking is both a new lead (CRM) and a new appointment (diary) | name, contact, service, message?, saved |
| `review.submitted` | `app/api/reviews/route.ts`, after a review is accepted | name, rating, text, service?, saved |

`saved` is `true` when the record was persisted to Supabase and
`false` in demo mode (Supabase unconfigured) — the event still fires
so the workflows are testable without Supabase. The duplicate guard
in `/api/lead` does **not** re-emit: the original submit already did.

`N8N_WEBHOOK_URL` is the webhook **base** URL and the event type is
appended as the path, so one env var wires up every workflow:

- App on the host + n8n in Docker: `N8N_WEBHOOK_URL=http://localhost:5678/webhook`
- Both in Docker Compose: `N8N_WEBHOOK_URL=http://n8n:5678/webhook`

(localhost inside the app container is the app itself, not n8n —
use the `n8n` service name there.)

Emitting is fire-and-forget: the route never awaits the POST, the
POST times out after 3 seconds, and failures are swallowed (logged,
not thrown). When the var is unset the emit is a silent no-op and
the site behaves exactly as if automations did not exist.
Serverless caveat: on a short-lived serverless function the floating
POST can be cut off when the function freezes. The demo runs as a
long-lived server (`npm run dev` / Docker), where the POST
completes; in production, use Next.js `after()` (Next 15+) or a
queue instead of a floating promise.

## The three workflows (`n8n/workflows/`)

All three import **inactive** — the owner activates each one in n8n
after checking it. All three end in a Set node whose output is the
draft; the owner reads it in n8n → **Executions** → open the run →
the Set node's output.

| File | Trigger | What it does |
|---|---|---|
| `lead-followup-draft.json` | Webhook `lead.created` | AI drafts a personalised follow-up to confirm the booking |
| `appointment-reminder-draft.json` | Webhook `appointment.booked` | Waits 24h, then AI drafts a reminder for the upcoming appointment |
| `review-thankyou-draft.json` | Webhook `review.submitted` | AI drafts a personal thank-you note for the review |

**The 24-hour wait is a stand-in.** The booking form takes no date,
so the reminder workflow waits 24 hours after booking as an
approximation of "the day before". In production the booking would
carry a date and the Wait node would use "on a specific date"
instead. For the demo, set the Wait node to **1 minute** to see the
draft without waiting a day.

**The AI step needs the owner's own OpenAI key.** Each workflow's
OpenAI node carries a placeholder credential, so n8n flags it until
the owner adds a key (n8n → Credentials → New → OpenAI → paste the
key). Without a key the workflow stops at the AI node with a
credential error — nothing breaks, nothing is sent. The model is
`gpt-4o-mini` (a few cents per thousand drafts). The prompts tell
the model to use only the details given and never invent prices,
services or times.

## Setup on the Mac (in order)

Terminal, salon folder (`cd ai-chatbot-site` first). Docker Desktop
must be installed and running.

```bash
docker compose up --build
```

This starts two containers: the app on http://localhost:3000 and
n8n on http://localhost:5678. The n8n login is `admin` /
`change-me` by default — **change it first**: create a `.env` file
in the salon folder with your own values (it is gitignored, never
commit it):

```bash
N8N_USER=owner
N8N_PASSWORD=<a password you choose>
```

then restart compose (`docker compose down && docker compose up --build`).

1. Open http://localhost:5678 and sign in.
2. Add your OpenAI credential: **Credentials → New → OpenAI**,
   paste your key, save. (Without this the workflows stop at the
   AI node — expected.)
3. Import the workflows: **Workflows → … → Import from File**,
   pick each JSON in `n8n/workflows/`. Each one arrives inactive.
4. Wire the app to n8n: in `.env.local` (salon folder) set
   `N8N_WEBHOOK_URL=http://localhost:5678/webhook` — or
   `http://n8n:5678/webhook` if the app is also running in Docker —
   then restart the app (`npm run dev` again, or
   `docker compose restart app`).
5. Activate each workflow in n8n (toggle at the top right of the
   workflow). Note the two webhook URLs n8n shows: **Production**
   (`/webhook/...`, used when the workflow is active) and **Test**
   (`/webhook-test/...`, only while you click "Execute step" in the
   editor). The app uses the production URL.

## Test it end to end

1. `docker compose up --build`, n8n open, workflows imported and
   **active**, OpenAI credential added, `N8N_WEBHOOK_URL` set and
   the app restarted.
2. Open http://localhost:3000, fill in **Book an appointment**
   (name "Test Lead", any contact, any service) and submit. The
   page says thanks — the booking still works even if n8n is down.
3. In n8n → **Executions**, open the "Lead follow-up draft" run:
   the Set node's output is the AI-drafted follow-up. The
   "Appointment reminder draft" run appears too, and finishes its
   Wait after 24h (or 1 minute if you shortened it for the demo).
4. Leave a review on the homepage (any name, 5 stars, a sentence)
   and check the "Review thank-you draft" run the same way.

If a run never appears: check the workflow is active (not just
saved), that the app was restarted after setting
`N8N_WEBHOOK_URL`, and that the webhook path matches the event
type (`lead.created`, `appointment.booked`, `review.submitted`).
The app logs `Automation event <type> failed to send` when the
POST itself fails.

## Turning a workflow on and off

In n8n, open the workflow and flip the **Active** toggle at the top
right. Inactive workflows keep their executions history but ignore
new events. To stop everything at the app end instead, remove
`N8N_WEBHOOK_URL` from `.env.local` and restart the app — the emit
becomes a no-op. To stop n8n entirely: `docker compose down`
(add `-v` to also delete the n8n data volume and all workflows).

## What was verified here vs on the Mac

Verified in this workspace: `npm run build` passes, `npm test`
passes (including `__tests__/events.test.ts` — the emit is a no-op
unconfigured and posts the right payload when configured, mocked
fetch, no network), eval 7/7, `docker-compose.yml` parses with
both services, and all three workflow JSONs parse with the required
n8n structure (nodes + connections + webhook paths + OpenAI
credentials placeholder) — see `/tmp/validate_n8n.py` for the
checks that were run.

**Not verified here, because Docker is not installed in this
workspace: no n8n container ran here, no workflow was imported or
executed, and no real webhook POST landed in n8n.** The first real
run is on the Mac with Docker Desktop, following the steps above.

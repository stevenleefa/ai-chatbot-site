# Lumen Hair Studio — AI chatbot site (starter)

A Next.js business site for a fictional salon, with a grounded AI chatbot.
This is Milestone 1 of S's AI web developer path: a site you can show a
client, not just a tutorial project.

## What it does

- Business site: services, prices, hours, booking/lead form
- Chat widget (bottom right) that answers only from `lib/business.ts`
- Retrieval in `lib/retrieve.ts`: keyword/token matching over business chunks
- Guardrail: if nothing matches, the bot says it does not know and points
  to the phone number / booking form — it never invents a price or hours
- Free mode by default: no API key needed, answers are the retrieved facts
- Optional LLM mode: set `OPENAI_API_KEY` and `/api/chat` will rewrite the
  answer from the retrieved chunks only, with temperature 0
- Eval: `scripts/eval.mjs` checks 7 questions, including out-of-scope ones

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

In a second terminal, with the dev server running:

```bash
npm run eval
```

## Deploy free

Push to GitHub, import the repo in Vercel, deploy. No environment
variables are needed for the free grounded mode.

## Swap in a real client (the repeatable part)

1. Edit only `lib/business.ts`: business details, services, and the
   `knowledge` array.
2. Update the suggested questions in `components/ChatWidget.tsx`.
3. Re-run the eval, adding that business's real questions.
4. Wire `/api/lead` to Supabase or email — it currently logs the lead
   and returns a confirmation (see the TODO in that file).

That 4-step swap is the service you can sell again and again.

## Next upgrades (in order)

1. Supabase for leads + pgvector for real embedding search, replacing
   the keyword retrieval in `lib/retrieve.ts`.
2. Structured lead output (name, service, preferred time) instead of free text.
3. More eval cases from real client questions, tracked in the eval script.
4. Analytics: which questions fall back to "I don't know" — those are the
   next knowledge chunks to add.
5. A second demo in a different niche (e.g. restaurant, trades) to prove
   the pattern is not salon-specific.

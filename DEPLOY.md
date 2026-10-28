# Deploy this site on Vercel

This project is deploy-ready: production build passes, no environment
variables are needed for the free grounded chatbot mode.

## Option A — from Muse (recommended here)

1. Connect Vercel in Muse (the connect link Muse shared in chat).
2. Tell Muse "Vercel is connected".
3. Muse will deploy this folder and return the live URL.

## Option B — from the Vercel dashboard

1. Push this folder to a GitHub repo.
2. In Vercel, New Project → Import that repo.
3. Leave the framework as Next.js, deploy with no extra settings.

## After deploy

- Test the chat widget on the live URL with the questions in
  `scripts/eval.mjs`.
- The same steps deploy the plumbing demo in
  `../ai-chatbot-site-plumbing/` — deploy it as a second Vercel project
  if you want two live portfolio links.

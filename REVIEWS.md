# Reviews — Lumen Hair Studio

Public reviews on the homepage (`#reviews`, linked from the fixed
top nav) and the rave-review pop-ups on public pages.

## Seed reviews — `lib/reviews.ts`

The public list must not start empty, so it is seeded in code with
6 fictional 5-star reviews from the regulars (the same reviews the
pop-ups rotate through — one source of truth, imported from both
places). They are marked in code as demo seed data. The quotes are
short and each reviewer is paired with a service they actually had
(verified against `lib/customers.ts`):

- Emma Thompson — Full colour — "My colour is exactly what I asked for, and it still looks fresh weeks later."
- Grace Liu — Haircut — "Best haircut I've had in years. I walked out feeling like a new person."
- Ava Rodriguez — Balayage — "My balayage has never looked better. Sofia is a genius with colour."
- Liam O'Connor — Beard trim — "Quick, precise beard trim with a proper hot towel finish. I'll be back every three weeks."
- Sophia Kim — Haircut — "They listened to what I wanted and the result is stunning. Booking my next visit already."
- Mia Johansson — Full colour — "Friendly, unhurried, and my hair has never been easier to style at home."

`lib/reviews.ts` also holds the shared helpers: `initials(name)`,
`avatarColour(name)` (deterministic hash into the five WCAG-verified
dark hues), `averageRating(reviews)`, `stars(rating)`.

## Storage — `supabase/reviews-schema.sql`

Run `supabase/reviews-schema.sql` once in the Supabase SQL Editor of
the ai-leads project. `public.reviews` (id, created_at, name, rating
int check 1–5, text, service nullable, status pending/approved
default 'pending'). RLS on with NO public policies (service-role
only, like leads).

## Flow — submit → pending → approve

1. A visitor fills in the "Leave a review" form (name, a star
   rating picker, optional service, written review) and submits.
   The form sits next to the booking form in a two-column row
   (`.booking-review-row` in `app/globals.css` — Book on the left,
   review on the right; they stack vertically below 900px), under
   the review list in the Reviews section. Its heading is an `h2`
   sized by the row rule so it matches "Book an appointment".
2. `POST /api/reviews` validates (name 1–100 chars, rating integer
   1–5, text 1–1,000 chars, **no URLs in the text** — a simple spam
   control — service optional ≤ 100 chars), rate-limits per IP
   (10/min, like `/api/lead`), and saves the review as **pending**.
   The form tells the submitter plainly: "Thanks — your review will
   appear once the studio approves it." When Supabase is not
   configured it answers honestly (`saved: false`, "not being saved
   yet") instead of pretending.
3. An admin approves or deletes the review in the **"Review
   approvals"** section of `/admin` (admin only; pending count in the
   heading). The server actions `approveReview` / `deleteReview` in
   `app/admin/actions.ts` re-check the caller is an active admin and
   revalidate `/admin` and `/` on approve.
4. `GET /api/reviews` (and the homepage, via `lib/reviews-server.ts`
   `getPublicReviews()`) returns the **approved** visitor reviews
   plus the seed reviews, newest first. Pending reviews never appear
   publicly.

## Avatars (face icons)

No photos of real people — the reviewers are fictional/unknown.
Every reviewer gets an **initials avatar**: a coloured circle with
their initials ("ET" for Emma Thompson), in `components/ReviewAvatar.tsx`.
The colours are the five WCAG-verified dark hues (navy `#1e3a5f`,
dark red `#7f1d1d`, dark teal `#0f766e`, dark green `#166534`, dark
amber `#92400e`) — white initials on them pass AA. The same avatar is
used in the review list and in the pop-ups. The avatar is
`aria-hidden` because the reviewer's name is adjacent text.

## Rave-review pop-ups — `components/ReviewPopups.tsx`

A small fixed card at the **bottom-left** of public pages only
(homepage and `/products` — not owner pages, not `/login`). It
rotates through the seed reviews one at a time, fading in and out
every ~8 seconds. It has a visible dismiss button, pauses on
hover, and respects `prefers-reduced-motion` (no rotation — one
static review instead). Dismissing hides the pop-ups for this page
load only — a refresh (or navigating to another page) brings them
back. It used to persist the dismiss in `localStorage`
(`lumen-review-popups-dismissed=1`), so once closed the pop-ups
never came back; that was changed 2026-11-11 at the owner's
request. Accessibility: the rotating text is
`aria-hidden` (the same reviews are in full in the Reviews section,
so the pop-up is a visual duplicate), but the dismiss button sits
outside the `aria-hidden` region so it stays keyboard-reachable. It
never covers the chat widget (bottom-right) or the nav, and it plays
no sound.

## Replacing the seed reviews with real ones

When the studio has real reviews, delete the seed list from
`lib/reviews.ts` (and the `SEED_REVIEWS` import in
`components/ReviewPopups.tsx` — the pop-ups fall back to the first
approved visitor review, or hide when there are none) and let
visitor reviews approved on `/admin` fill the list. Until then the
seed reviews are clearly demo data for fictional regulars.

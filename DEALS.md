# Deals and coupons

`/deals` lists the demo offers from `lib/deals.ts`. Each deal has a
coupon `code` (e.g. `LUMEN20`) and a QR code on its card.

## How the QR codes work

- The QR encodes the deal's coupon URL: the production site plus
  `/deals?coupon=<code>` — e.g.
  `https://ai-chatbot-site-tawny.vercel.app/deals?coupon=LUMEN20`
  (see `couponUrl()` in `lib/deals.ts`). It always points at
  production, because a phone that scans a QR cannot reach
  localhost — even when the page is viewed on a dev clone.
- Scanning the QR opens that URL, and the page reads the `?coupon=`
  param and pops the coupon dialog for that deal
  (`components/DealsClient.tsx` + `components/CouponDialog.tsx`).
  An unknown code shows the deals with no dialog.
- Tapping the QR code, or the "Show coupon" button under it, opens
  the same dialog.
- Closing the dialog drops the `?coupon=` param (so a refresh does
  not reopen it) and returns focus to the button that opened it.

## The coupon dialog

A native `<dialog>`, following the sign-out dialog pattern
(`components/SignOutButton.tsx`): `showModal()` puts it on the top
layer, Escape closes it, clicking the backdrop closes it, the
Close button is focused on open, and closing returns focus to the
trigger. The dialog shows the deal, the big coupon code, and the
terms.

## Changing the offers

Edit only `lib/deals.ts`: title, description, highlight, terms and
`code`. The QR codes and the dialog pick the changes up
automatically — nothing else needs editing. If the live site's
address ever changes, update `SITE_URL` in the same file (the QR
codes encode it).

## Implementation notes

- QR rendering is `react-qr-code` (SVG, `size={120}`, black on
  white). The QR sits on a white pad so it scans in either theme.
- The deals page is a server component (`app/deals/page.tsx`) with
  the cards in a client component (`components/DealsClient.tsx`),
  because reading `?coupon=` needs `useSearchParams`, which needs
  a Suspense boundary.
- The offers are demo content, not real promotions — a real client
  replaces them with their own current offers.

"use client";

import { useEffect, useId, useRef } from "react";
import type { Deal } from "@/lib/deals";

// Coupon dialog for /deals (components/DealsClient.tsx). Same native
// <dialog> pattern as the sign-out dialog (components/SignOutButton.tsx):
// showModal() puts it on the top layer, Escape closes it, clicking
// the backdrop closes it, the Close button is focused on open (the
// safe choice — it is not a destructive action, so focus goes to the
// single way out), and closing returns focus to the button that
// opened it (handled by the parent's onClose). The dialog only
// renders while a deal is set; unmounting it is the close.
export default function CouponDialog({
  deal,
  onClose,
}: {
  deal: Deal | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Runs when a deal is set: the <dialog> has just mounted, so open
  // it as a modal. (It must depend on `deal`, not run once on mount
  // — on mount there is no deal and no dialog element yet.)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !deal || dialog.open) return;
    dialog.showModal();
  }, [deal ]);

  if (!deal) return null;

  return (
    <dialog
      ref={dialogRef}
      className="coupon-dialog"
      aria-labelledby={titleId}
      onClick={(e) => {
        // Clicking the backdrop (the dialog itself, outside its
        // content) closes, like Escape does.
        if (e.target === dialogRef.current) onClose();
      }}
      onClose={onClose}
    >
      <h2 id={titleId}>{deal.title}</h2>
      <p>{deal.description}</p>
      <p className="coupon-code" aria-label={`Coupon code ${deal.code}`}>
        {deal.code}
      </p>
      <p>{deal.terms}</p>
      <p>Show this code at the studio, or mention it when you book.</p>
      <div className="coupon-actions">
        <button
          type="button"
          className="signout-cancel"
          onClick={onClose}
          autoFocus
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

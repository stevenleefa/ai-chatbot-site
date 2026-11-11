"use client";

import { useEffect, useRef, useState } from "react";
import { SEED_REVIEWS } from "@/lib/reviews";
import ReviewAvatar from "./ReviewAvatar";
import Stars from "./Stars";

// Rave-review pop-up: a small fixed card on the bottom-left of
// PUBLIC pages only (homepage and /products — it is rendered by
// those pages, never by the layout, so owner pages never see it).
// One short 5-star review at a time, fading out and back in every
// ~8 seconds through the seed reviews. The chat widget is
// bottom-right, so the two never overlap.
//
// Accessibility: the rotating text is a visual duplicate of the
// Reviews section, so it is aria-hidden (it must not interrupt
// screen readers every 8 seconds); the dismiss button sits OUTSIDE
// the aria-hidden region so it stays keyboard-reachable. Hovering
// pauses the rotation. When the system prefers reduced motion there
// is no rotation at all — one static review. Dismissing hides the
// pop-ups for this page load only — a refresh (or navigating to
// another page) brings them back. It used to remember the dismiss
// in localStorage, so once closed the pop-ups never came back; the
// owner asked for them to return on refresh.
const ROTATE_MS = 8000;
const FADE_MS = 500;

export default function ReviewPopups() {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (dismissed || reducedMotion) return;
    function schedule() {
      timerRef.current = setTimeout(() => {
        if (pausedRef.current) {
          // Hovering: wait out this tick and try again.
          schedule();
          return;
        }
        setFading(true);
        swapRef.current = setTimeout(() => {
          setIndex((i) => (i + 1) % SEED_REVIEWS.length);
          setFading(false);
          schedule();
        }, FADE_MS);
      }, ROTATE_MS);
    }
    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (swapRef.current) clearTimeout(swapRef.current);
    };
  }, [dismissed, reducedMotion]);

  if (dismissed) return null;
  const review = SEED_REVIEWS[index];

  function dismiss() {
    // Page-load only — no localStorage, so a refresh brings the
    // pop-ups back.
    setDismissed(true);
  }

  return (
    <aside
      className={`review-popup${fading ? " fading" : ""}`}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      {/* aria-hidden: the same reviews are in full in the Reviews
          section — this rotating copy must not interrupt screen
          readers. The dismiss button below is outside this div so
          it stays reachable. */}
      <div aria-hidden="true">
        <div className="review-popup-head">
          <ReviewAvatar name={review.name} />
          <strong>{review.name}</strong>
          <Stars rating={review.rating} />
        </div>
        <p className="review-popup-text">&ldquo;{review.text}&rdquo;</p>
        <p className="review-popup-service">{review.service}</p>
      </div>
      <button
        type="button"
        className="review-popup-close"
        aria-label="Hide review pop-ups"
        onClick={dismiss}
      >
        ✕
      </button>
    </aside>
  );
}

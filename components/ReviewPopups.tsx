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
// owner asked for them to return on refresh. Clicking the pop-up
// body follows a link to the Reviews section (/#reviews, like the
// nav "Reviews" link, so it works from /products too); the dismiss
// X is a separate button, not inside the link.
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
      {/* The pop-up body is a link to the Reviews section: clicking
          it scrolls down to the full list. The rotating text is a
          visual duplicate of that section, so it stays aria-hidden
          and the link carries its own label; the dismiss button
          below is outside the link so it stays reachable. */}
      <a href="/#reviews" className="review-popup-link" aria-label="Read all customer reviews">
        <div aria-hidden="true">
          <div className="review-popup-head">
            <ReviewAvatar name={review.name} />
            <strong>{review.name}</strong>
            <Stars rating={review.rating} />
          </div>
          <p className="review-popup-text">&ldquo;{review.text}&rdquo;</p>
          <p className="review-popup-service">{review.service}</p>
        </div>
      </a>
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

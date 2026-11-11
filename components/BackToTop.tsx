"use client";

import { useEffect, useState } from "react";

// "Back to top" pill, fixed at the bottom centre of the viewport. It
// only appears on a page longer than one screen, once you have
// scrolled down a bit — short pages never show it. Bottom centre so
// it never covers the chat widget (bottom-right) or the review
// pop-ups (bottom-left). Clicking smooth-scrolls to the top, or
// jumps straight there when the system prefers reduced motion.
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    function onScroll() {
      setVisible(
        window.scrollY > 200 &&
          document.documentElement.scrollHeight > window.innerHeight + 200
      );
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: reducedMotion ? "auto" : "smooth",
        })
      }
    >
      <span aria-hidden="true">↑</span> Back to top
    </button>
  );
}

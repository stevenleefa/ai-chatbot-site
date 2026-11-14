"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  TOUR_START_EVENT,
  TOUR_STEPS,
  clearTourProgress,
  findHeadingElement,
  saveTourProgress,
} from "@/lib/tour";

// Guided tour — six steps through the site, started only when the
// customer asks for it (the "Take a guided tour" / "Resume tour"
// rows in the hamburger menu dispatch TOUR_START_EVENT). It never
// auto-starts on page load. Each step navigates to its page,
// scrolls the target into view, highlights that target with the
// "tour-highlight" outline (app/globals.css) so the customer can
// see what the step is about, and shows a small tooltip card
// with Back / Next / Skip tour and a "Step X of 6" indicator.
// While the tour is showing it also sets data-tour-active on
// <body>, which hides the bottom-left review pop-ups
// (components/ReviewPopups.tsx) until the tour closes.
//
// Dismissible: "Skip tour" on every step, and Escape closes it.
// Resumable: progress (steps completed, finished only at the end)
// is saved to localStorage ("lumen-tour"), so closing mid-tour
// offers "Resume tour" in the menu later; closing mid-tour never
// marks it finished.
//
// Keyboard: the tooltip is a real dialog region (role="dialog"),
// focus moves into it on each step, Escape closes it and focus
// returns to the hamburger button (the menu row that started it
// is gone — the menu closed when the tour started). All controls
// are real <button>s. prefers-reduced-motion is honoured: no
// smooth scrolling, the page jumps straight to the target.
//
// Styling is inline, using the existing CSS variables, so the card
// follows light/dark mode with no new CSS (app/globals.css is
// owned by another track this wave).

const CARD_STYLE: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: 24,
  zIndex: 90,
  width: "calc(100vw - 32px)",
  maxWidth: 420,
  background: "var(--surface)",
  color: "var(--plum)",
  border: "1px solid var(--border)",
  borderTop: "5px solid var(--rose)",
  borderRadius: 16,
  padding: "16px 18px",
  boxShadow: "0 16px 40px rgba(61, 36, 51, 0.25)",
};

const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
  background: "transparent",
  color: "var(--plum)",
  border: "1px solid var(--border)",
};

export default function GuidedTour() {
  // Active step index, or null when the tour is not showing.
  const [index, setIndex] = useState<number | null>(null);
  const [completed, setCompleted] = useState(0);
  const completedRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // The element currently carrying the "tour-highlight" outline,
  // so the next step (or the tour closing) can take it off again.
  const highlightedRef = useRef<Element | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // While the tour is showing, mark <body> so the review pop-ups
  // (components/ReviewPopups.tsx) hide until the tour closes.
  // The attribute is removed on close and on unmount.
  useEffect(() => {
    if (index === null) return;
    document.body.setAttribute("data-tour-active", "true");
    return () => {
      document.body.removeAttribute("data-tour-active");
    };
  }, [index]);

  // The menu starts (or resumes) the tour with this event:
  // new CustomEvent("lumen:start-tour", { detail: { step } }).
  useEffect(() => {
    function onStart(e: Event) {
      const detail = (e as CustomEvent<{ step?: number }>).detail ?? {};
      const step =
        typeof detail.step === "number"
          ? Math.min(Math.max(detail.step, 0), TOUR_STEPS.length - 1)
          : 0;
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      completedRef.current = step;
      setCompleted(step);
      setIndex(step);
    }
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, []);

  function closeTour(finished: boolean) {
    const done = finished ? TOUR_STEPS.length : completedRef.current;
    if (done > 0 || finished) {
      saveTourProgress({ completed: done, finished });
    } else {
      clearTourProgress();
    }
    setIndex(null);
    // The menu row that started the tour is gone (the menu closed
    // when the tour started), so focus goes back to the hamburger
    // button — or to the trigger itself if it is still in the page.
    const trigger = returnFocusRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    } else {
      (document.querySelector(".hamburger-button") as HTMLElement | null)?.focus();
    }
  }

  // Escape closes the tour (and saves progress) while it is open.
  useEffect(() => {
    if (index === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeTour(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // closeTour reads completedRef, so it is stable to call here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // On each step: navigate to the step's page if needed, scroll
  // the target into view, highlight it with the "tour-highlight"
  // outline (so the customer can see what the step is about), and
  // move focus into the tooltip card. The highlight is taken off
  // the old target when the step changes or the tour closes — the
  // cleanup below runs on every index change and on unmount.
  // Highlighting never moves focus: focus stays in the tooltip.
  useEffect(() => {
    if (index === null) return;
    const step = TOUR_STEPS[index];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
    function findTarget(): Element | null {
      let el: Element | null = null;
      if (step.selector) el = document.querySelector(step.selector);
      if (!el && step.heading) el = findHeadingElement(step.heading);
      if (!el) el = document.querySelector("#main-content");
      return el;
    }
    function scrollToTarget() {
      const el = findTarget();
      el?.scrollIntoView({ behavior, block: "start" });
    }
    const [path, hash] = step.href.split("#");
    const targetPath = path || pathname;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    if (targetPath !== pathname || (hash && window.location.hash !== `#${hash}`)) {
      router.push(step.href);
      // Wait for the navigation to render before scrolling.
      scrollTimer = setTimeout(scrollToTarget, 400);
    } else {
      scrollToTarget();
    }
    // Highlight the target once it is in the page. The navigation
    // above may render it late, so retry briefly after the scroll
    // timer as well as right away.
    function highlightTarget() {
      const el = findTarget();
      if (!el) return;
      if (highlightedRef.current && highlightedRef.current !== el) {
        highlightedRef.current.classList.remove("tour-highlight");
      }
      el.classList.add("tour-highlight");
      highlightedRef.current = el;
    }
    highlightTarget();
    const highlightTimer = setTimeout(highlightTarget, 450);
    const focusTimer = setTimeout(() => cardRef.current?.focus(), 50);
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      clearTimeout(highlightTimer);
      clearTimeout(focusTimer);
      highlightedRef.current?.classList.remove("tour-highlight");
      highlightedRef.current = null;
    };
  }, [index, pathname, router]);

  function goNext() {
    if (index === null) return;
    if (index === TOUR_STEPS.length - 1) {
      closeTour(true);
      return;
    }
    const next = index + 1;
    completedRef.current = next;
    setCompleted(next);
    setIndex(next);
  }

  function goBack() {
    if (index === null || index === 0) return;
    setIndex(index - 1);
  }

  if (index === null) return null;
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-label="Guided tour"
      aria-describedby="tour-text"
      ref={cardRef}
      tabIndex={-1}
      style={CARD_STYLE}
    >
      <p style={{ margin: "0 0 6px", fontSize: "1.125rem" }}>
        <strong>{step.title}</strong>
      </p>
      <p id="tour-text" style={{ margin: "0 0 12px" }}>
        {step.text}
      </p>
      <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
        Step {index + 1} of {TOUR_STEPS.length}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={goBack} disabled={index === 0} style={SECONDARY_BUTTON_STYLE}>
          Back
        </button>
        <button type="button" onClick={goNext}>
          {isLast ? "Finish" : "Next"}
        </button>
        <button type="button" onClick={() => closeTour(false)} style={SECONDARY_BUTTON_STYLE}>
          Skip tour
        </button>
      </div>
    </div>
  );
}

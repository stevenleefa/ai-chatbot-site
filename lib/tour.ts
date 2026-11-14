// Guided tour — steps and progress helpers.
//
// The tour (components/GuidedTour.tsx) walks a customer through
// the site in six steps. Each step names the page to go to and
// the element to scroll to; the component does the navigating.
// Progress lives in localStorage under TOUR_STORAGE_KEY so a
// mid-tour close can be resumed: `completed` counts finished
// steps (0–6) and `finished` is set only by reaching the end.
// Closing mid-tour saves the count but never marks it finished.
//
// While a step is showing, the tour also highlights its target
// element (components/GuidedTour.tsx adds the "tour-highlight"
// class) and hides the bottom-left review pop-ups
// (components/ReviewPopups.tsx watches the "data-tour-active"
// attribute the tour sets on <body>).
//
// Pure helpers are unit-tested (see __tests__/tour.test.ts); the
// component itself owns the DOM work (scrolling, focus).

export type TourStep = {
  id: string;
  title: string;
  text: string;
  // Page to navigate to ("/#services" is the homepage services
  // section; "/products" and "/my-account" are pages).
  href: string;
  // Element to scroll into view once there, when it exists.
  selector?: string;
  // Fallback for steps whose target has no stable id: scroll to
  // the first heading containing this text (the referral section
  // on /my-account), else the top of the page.
  heading?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "services",
    title: "Services & prices",
    text: "Lumen offers haircuts ($35), full colour (from $70), balayage (from $110) and beard trims ($15) — see them all in the Services section.",
    href: "/#services",
    selector: "#services",
  },
  {
    id: "booking",
    title: "How to book",
    text: "Pick a service, leave your name and a phone number or email, and choose a day and time. The studio confirms every booking.",
    href: "/#booking",
    selector: "#booking",
  },
  {
    id: "shop",
    title: "The shop",
    text: "Browse the product range, add items to your cart and check out securely for in-store pickup at 12 Maple Street.",
    href: "/products",
    selector: ".product-grid",
  },
  {
    id: "featured",
    title: "Featured product",
    text: "Each week one product is featured — right now it is the Colour-care mask ($32), a weekly deep mask for coloured hair. The featured product changes from time to time.",
    href: "/products",
    selector: ".featured-section",
  },
  {
    id: "account",
    title: "Your account",
    text: "Your account shows your bookings and orders, matched to your email. Sign in from the menu to see yours.",
    href: "/my-account",
    selector: "#main-content",
  },
  {
    id: "referral",
    title: "Refer a friend",
    text: "Share your referral link from your account — when a friend books, you get 50% off your next haircut.",
    href: "/my-account",
    heading: "Refer",
  },
];

export const TOUR_STORAGE_KEY = "lumen-tour";

export type TourProgress = {
  completed: number; // steps finished, 0–6
  finished: boolean; // true only when the last step was completed
};

// The hamburger menu dispatches this to start (or resume) the
// tour; the tour component listens for it.
export const TOUR_START_EVENT = "lumen:start-tour";

export function nextStepIndex(index: number): number | null {
  return index + 1 < TOUR_STEPS.length ? index + 1 : null;
}

export function prevStepIndex(index: number): number | null {
  return index - 1 >= 0 ? index - 1 : null;
}

// Where a resume starts: the first unfinished step, or null when
// the tour was already finished (the menu offers "Restart tour"
// instead) or never started.
export function resumeStepIndex(progress: TourProgress | null): number | null {
  if (!progress || progress.finished) return null;
  if (progress.completed <= 0) return null;
  if (progress.completed >= TOUR_STEPS.length) return null;
  return progress.completed;
}

export function getTourProgress(): TourProgress | null {
  try {
    const raw = window.localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as TourProgress).completed !== "number" ||
      typeof (parsed as TourProgress).finished !== "boolean"
    ) {
      return null;
    }
    const completed = Math.min(
      TOUR_STEPS.length,
      Math.max(0, Math.floor((parsed as TourProgress).completed))
    );
    return { completed, finished: (parsed as TourProgress).finished };
  } catch {
    return null;
  }
}

export function saveTourProgress(progress: TourProgress): void {
  try {
    window.localStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({
        completed: Math.min(
          TOUR_STEPS.length,
          Math.max(0, Math.floor(progress.completed))
        ),
        finished: progress.finished,
      })
    );
  } catch {
    // Storage unavailable — the tour still works for this visit.
  }
}

export function clearTourProgress(): void {
  try {
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

// First heading (h1–h3) containing the given text, case-insensitive.
// Used for the referral step, whose section on /my-account has no
// stable id to target.
export function findHeadingElement(text: string): Element | null {
  const headings = document.querySelectorAll("h1, h2, h3");
  const needle = text.toLowerCase();
  for (const h of Array.from(headings)) {
    if ((h.textContent ?? "").toLowerCase().includes(needle)) return h;
  }
  return null;
}

// Guided-tour helper tests (lib/tour.ts). The six steps, the
// step navigation, and the localStorage progress (resume /
// restart / never-started). The component's DOM work (scrolling,
// focus, highlight) is tested in GuidedTour.test.tsx.
import {
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  clearTourProgress,
  findHeadingElement,
  getTourProgress,
  nextStepIndex,
  prevStepIndex,
  resumeStepIndex,
  saveTourProgress,
} from "@/lib/tour";

describe("TOUR_STEPS", () => {
  it("has six steps in order: services, booking, shop, featured, account, referral", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "services",
      "booking",
      "shop",
      "featured",
      "account",
      "referral",
    ]);
  });

  it("every step has a title, text and a target page", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.text.length).toBeGreaterThan(0);
      expect(step.href.startsWith("/")).toBe(true);
    }
  });

  it("the featured step targets the Featured section on /products", () => {
    const featured = TOUR_STEPS[3];
    expect(featured.href).toBe("/products");
    expect(featured.selector).toBe(".featured-section");
  });

  it("the referral step targets the account page and its referral heading", () => {
    const referral = TOUR_STEPS[5];
    expect(referral.href).toBe("/my-account");
    expect(referral.heading).toBe("Refer");
  });
});

describe("nextStepIndex / prevStepIndex", () => {
  it("advances and retreats, returning null at the ends", () => {
    expect(nextStepIndex(0)).toBe(1);
    expect(nextStepIndex(4)).toBe(5);
    expect(nextStepIndex(5)).toBeNull();
    expect(prevStepIndex(1)).toBe(0);
    expect(prevStepIndex(0)).toBeNull();
  });
});

describe("tour progress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is null when the tour was never started", () => {
    expect(getTourProgress()).toBeNull();
    expect(resumeStepIndex(getTourProgress())).toBeNull();
  });

  it("resumes at the first unfinished step after a mid-tour close", () => {
    saveTourProgress({ completed: 2, finished: false });
    expect(getTourProgress()).toEqual({ completed: 2, finished: false });
    expect(resumeStepIndex(getTourProgress())).toBe(2);
  });

  it("does not offer a resume when finished (the menu offers Restart instead)", () => {
    saveTourProgress({ completed: 6, finished: true });
    expect(resumeStepIndex(getTourProgress())).toBeNull();
  });

  it("does not offer a resume when nothing was completed", () => {
    saveTourProgress({ completed: 0, finished: false });
    expect(resumeStepIndex(getTourProgress())).toBeNull();
  });

  it("closing mid-tour does not mark it finished", () => {
    saveTourProgress({ completed: 3, finished: false });
    expect(getTourProgress()?.finished).toBe(false);
  });

  it("clearing removes the saved progress", () => {
    saveTourProgress({ completed: 2, finished: false });
    clearTourProgress();
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBeNull();
  });

  it("ignores a corrupted save instead of crashing", () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "not json{");
    expect(getTourProgress()).toBeNull();
  });
});

describe("findHeadingElement", () => {
  it("finds the first heading containing the text", () => {
    document.body.innerHTML =
      "<h2>My bookings</h2><h2>Refer a friend</h2>";
    expect(findHeadingElement("Refer")?.textContent).toBe("Refer a friend");
    expect(findHeadingElement("Nope")).toBeNull();
  });
});

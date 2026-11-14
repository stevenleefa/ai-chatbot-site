// GuidedTour component tests (components/GuidedTour.tsx). The
// tour starts only from the "lumen:start-tour" event (dispatched
// by the hamburger menu), walks its five steps, and saves progress
// so it can be resumed. Scrolling is a jsdom stub here — the real
// scroll behaviour needs a browser.
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GuidedTour from "@/components/GuidedTour";
import { TOUR_STORAGE_KEY } from "@/lib/tour";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
}));

function setPrefersReducedMotion(reduce: boolean) {
  window.matchMedia = (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

beforeEach(() => {
  window.localStorage.clear();
  setPrefersReducedMotion(false);
  Element.prototype.scrollIntoView = jest.fn();
});

function startTour(step = 0) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("lumen:start-tour", { detail: { step } })
    );
  });
}

describe("GuidedTour", () => {
  it("renders nothing until the tour is started", () => {
    render(<GuidedTour />);
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
  });

  it("starts on the first step with a Step 1 of 5 indicator", () => {
    render(<GuidedTour />);
    startTour(0);
    expect(screen.getByRole("dialog", { name: "Guided tour" })).toBeInTheDocument();
    expect(screen.getByText("Services & prices")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("Next advances a step and Back goes back", () => {
    render(<GuidedTour />);
    startTour(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("How to book")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Services & prices")).toBeInTheDocument();
  });

  it("Skip tour closes it and saves the steps completed so far", () => {
    render(<GuidedTour />);
    startTour(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 1,
      finished: false,
    });
  });

  it("Escape closes it without marking it finished", () => {
    render(<GuidedTour />);
    startTour(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 1,
      finished: false,
    });
  });

  it("Finish on the last step marks the tour finished", () => {
    render(<GuidedTour />);
    startTour(4);
    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
    expect(screen.getByText("Refer a friend")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 5,
      finished: true,
    });
  });

  it("closing on the first step with nothing completed saves no progress", () => {
    render(<GuidedTour />);
    startTour(0);
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBeNull();
  });
});

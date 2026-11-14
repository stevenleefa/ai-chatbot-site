// Hamburger menu guided-tour rows (components/HamburgerMenu.tsx).
// "Take a guided tour" is always there; "Resume tour" appears
// with saved mid-tour progress and "Restart tour" once the tour
// was finished. Clicking a row dispatches the start event the
// tour component listens for. Opening the menu while the tour is
// showing dispatches the close event instead, so the tour gets
// out of the menu's way (its tooltip card otherwise holds focus
// and fights the menu panel, and the menu glitches closed before
// the user can reach Sign in).
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import GuidedTour from "@/components/GuidedTour";
import {
  TOUR_CLOSE_EVENT,
  TOUR_STORAGE_KEY,
  TOUR_START_EVENT,
} from "@/lib/tour";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
}));

function setPrefersDark(dark: boolean) {
  window.matchMedia = (query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
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
  document.documentElement.removeAttribute("data-theme");
  document.body.removeAttribute("data-tour-active");
  setPrefersDark(false);
  Element.prototype.scrollIntoView = jest.fn();
});

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
}

describe("HamburgerMenu guided tour rows", () => {
  it("offers Take a guided tour and dispatches the start event at step 0", () => {
    const steps: number[] = [];
    window.addEventListener(TOUR_START_EVENT, (e) => {
      steps.push((e as CustomEvent<{ step: number }>).detail.step);
    });
    render(<HamburgerMenu user={null} />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Take a guided tour" }));
    expect(steps).toEqual([0]);
    // The menu closes when the tour starts.
    expect(screen.queryByRole("button", { name: "Take a guided tour" })).not.toBeInTheDocument();
  });

  it("offers Resume tour at the saved step when there is mid-tour progress", () => {
    window.localStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({ completed: 2, finished: false })
    );
    const steps: number[] = [];
    window.addEventListener(TOUR_START_EVENT, (e) => {
      steps.push((e as CustomEvent<{ step: number }>).detail.step);
    });
    render(<HamburgerMenu user={null} />);
    openMenu();
    expect(
      screen.getByRole("button", { name: "Resume tour (step 3 of 6)" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume tour (step 3 of 6)" }));
    expect(steps).toEqual([2]);
  });

  it("offers Restart tour once the tour was finished, and no Resume", () => {
    window.localStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({ completed: 5, finished: true })
    );
    render(<HamburgerMenu user={null} />);
    openMenu();
    expect(screen.getByRole("button", { name: "Restart tour" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resume tour/ })).not.toBeInTheDocument();
  });

  it("offers neither Resume nor Restart when the tour was never started", () => {
    render(<HamburgerMenu user={null} />);
    openMenu();
    expect(screen.queryByRole("button", { name: /Resume tour/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restart tour" })).not.toBeInTheDocument();
  });

  it("opening the menu while the tour is active dispatches the close event", () => {
    const closed: number[] = [];
    window.addEventListener(TOUR_CLOSE_EVENT, () => {
      closed.push(1);
    });
    document.body.setAttribute("data-tour-active", "true");
    render(<HamburgerMenu user={null} />);
    openMenu();
    expect(closed).toEqual([1]);
    // The menu itself still opens — the close event is for the tour.
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("opening the menu with no tour active dispatches no close event", () => {
    const closed: number[] = [];
    window.addEventListener(TOUR_CLOSE_EVENT, () => {
      closed.push(1);
    });
    render(<HamburgerMenu user={null} />);
    openMenu();
    expect(closed).toEqual([]);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("opening the menu mid-tour closes the tour, keeps the menu open, and offers Resume", () => {
    render(
      <>
        <GuidedTour />
        <HamburgerMenu user={null} />
      </>
    );
    // Start the tour at step 3 (index 2, "The shop") the way the
    // menu's "Take a guided tour" row does.
    act(() => {
      window.dispatchEvent(
        new CustomEvent(TOUR_START_EVENT, { detail: { step: 2 } })
      );
    });
    expect(screen.getByRole("dialog", { name: "Guided tour" })).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 6")).toBeInTheDocument();
    // Open the menu mid-tour: the tour closes and the menu stays
    // open with Sign in reachable.
    openMenu();
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(document.body.hasAttribute("data-tour-active")).toBe(false);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    // Progress is saved as not finished, so the menu offers to
    // resume at the saved step.
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 2,
      finished: false,
    });
    expect(
      screen.getByRole("button", { name: "Resume tour (step 3 of 6)" })
    ).toBeInTheDocument();
  });
});

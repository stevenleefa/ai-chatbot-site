// Hamburger menu guided-tour rows (components/HamburgerMenu.tsx).
// "Take a guided tour" is always there; "Resume tour" appears
// with saved mid-tour progress and "Restart tour" once the tour
// was finished. Clicking a row dispatches the start event the
// tour component listens for.
import { render, screen, fireEvent } from "@testing-library/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import { TOUR_STORAGE_KEY, TOUR_START_EVENT } from "@/lib/tour";

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
  setPrefersDark(false);
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
      screen.getByRole("button", { name: "Resume tour (step 3 of 5)" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume tour (step 3 of 5)" }));
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
});

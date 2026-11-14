// components/ReviewPopups.tsx — the bottom-left review pop-up.
// It hides entirely while the guided tour is showing (the tour
// sets data-tour-active on <body>) and resumes when the tour
// closes, so the pop-ups never cover or fight the tour tooltip.
// The rotation pauses while hidden and resumes where it left off.
import { render, screen, waitFor } from "@testing-library/react";
import ReviewPopups from "@/components/ReviewPopups";

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
  document.body.removeAttribute("data-tour-active");
  setPrefersReducedMotion(false);
});

afterEach(() => {
  document.body.removeAttribute("data-tour-active");
});

describe("ReviewPopups during the guided tour", () => {
  it("shows a review normally", () => {
    render(<ReviewPopups />);
    expect(
      screen.getByRole("button", { name: "Hide review pop-ups" })
    ).toBeInTheDocument();
  });

  it("hides while the tour is active and resumes when it closes", async () => {
    render(<ReviewPopups />);
    expect(
      screen.getByRole("button", { name: "Hide review pop-ups" })
    ).toBeInTheDocument();
    document.body.setAttribute("data-tour-active", "true");
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Hide review pop-ups" })
      ).not.toBeInTheDocument();
    });
    document.body.removeAttribute("data-tour-active");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Hide review pop-ups" })
      ).toBeInTheDocument();
    });
  });
});

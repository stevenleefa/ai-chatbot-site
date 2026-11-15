// GuidedTour redirect-loop regression test.
//
// REPRODUCTION (2026-11-15, live site): a signed-out visitor takes
// the guided tour. Steps 5 and 6 ("Your account" and "Refer a
// friend") navigate to /my-account, but the server redirects a
// signed-out visitor to /login. The tour's step effect
// re-runs when the pathname changes (it depends on `pathname`),
// sees the target "/my-account" still differs from the redirected
// "/login", and pushes "/my-account" AGAIN — each push
// redirects back to sign-in, the pathname flips, the effect fires
// again, and the router is driven in an infinite push → redirect →
// push loop that crashes the page at the end of the tour. Steps 1–4
// never redirect (homepage and /products), so only the last two
// steps crash.
//
// The fix: the tour pushes a step's href at most once per step.
// When the navigation lands somewhere else (a redirect), it accepts
// the page it landed on and scrolls/highlights what is there
// instead of pushing again.
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GuidedTour from "@/components/GuidedTour";
import { TOUR_STORAGE_KEY } from "@/lib/tour";

// Stable router mock (one object, one push fn) so the step effect
// only re-runs when `pathname` or the step index changes — a fresh
// router object on every render would re-trigger the effect and
// mask the loop under test.
const pushMock = jest.fn();
const routerMock = { push: pushMock };
// Mutable pathname, so the test can simulate the server redirect
// landing the tour on /login instead of /my-account.
let mockPathname = "/";

jest.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => mockPathname,
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
  pushMock.mockClear();
  mockPathname = "/";
});

function startTour(step = 0) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("lumen:start-tour", { detail: { step } })
    );
  });
}

describe("GuidedTour redirect loop", () => {
  it("pushes /my-account once, then accepts the sign-in redirect instead of pushing again", () => {
    // The tour is on /products (step 4) and advances to the last
    // step, whose target is /my-account.
    mockPathname = "/products";
    const { rerender } = render(<GuidedTour />);
    startTour(5);
    expect(screen.getByText("Refer a friend")).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/my-account");

    // The server redirects a signed-out visitor to the single
    // sign-in page (/login), so the pathname becomes /login.
    // The step effect re-runs — and must NOT push /my-account
    // again, or the router loops push → redirect → push forever.
    mockPathname = "/login";
    act(() => {
      rerender(<GuidedTour />);
    });
    expect(pushMock).toHaveBeenCalledTimes(1);

    // The redirect target oscillates while the router settles
    // (/my-account briefly, then back to /login).
    // Still no second push for this step.
    mockPathname = "/my-account";
    act(() => {
      rerender(<GuidedTour />);
    });
    mockPathname = "/login";
    act(() => {
      rerender(<GuidedTour />);
    });
    expect(pushMock).toHaveBeenCalledTimes(1);

    // And Finish still completes the tour cleanly from the page
    // the redirect landed on.
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 6,
      finished: true,
    });
  });

  it("pushes again when the visitor returns to the same step later (Back then Next)", () => {
    // The once-per-step guard must not swallow a genuine
    // re-entry: leaving the step and coming back pushes again.
    mockPathname = "/products";
    render(<GuidedTour />);
    startTour(5);
    expect(pushMock).toHaveBeenCalledTimes(1);
    mockPathname = "/login";
    act(() => {
      // Re-render happens implicitly through the Back/Next clicks
      // below; the pathname mock is what the effect reads.
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    // Back goes to step 5 (account), also /my-account — a new
    // step, so it pushes again.
    expect(pushMock).toHaveBeenCalledWith("/my-account");
    const callsAfterBack = pushMock.mock.calls.length;
    expect(callsAfterBack).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Next returns to the referral step — a new entry, so it
    // pushes once more (and only once).
    expect(pushMock.mock.calls.length).toBe(callsAfterBack + 1);
  });
});

describe("GuidedTour finish returns home", () => {
  it("Finish on the last step navigates back to the homepage", () => {
    // The tour is on the sign-in page the /my-account redirect
    // landed on (steps 5–6 target /my-account). Finishing must
    // put the visitor back on the homepage, not leave them on
    // the sign-in page — and the finished progress is still saved.
    mockPathname = "/products";
    const { rerender } = render(<GuidedTour />);
    startTour(5);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/my-account");
    mockPathname = "/login";
    act(() => {
      rerender(<GuidedTour />);
    });
    expect(pushMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 6,
      finished: true,
    });
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("Skip mid-tour does not navigate home", () => {
    // Skipping closes the tour and saves progress but leaves the
    // visitor on the page they are on.
    render(<GuidedTour />);
    startTour(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 1,
      finished: false,
    });
    expect(pushMock).not.toHaveBeenCalledWith("/");
  });

  it("Escape mid-tour does not navigate home", () => {
    // Escape behaves the same as Skip: close and save progress,
    // no navigation.
    render(<GuidedTour />);
    startTour(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TOUR_STORAGE_KEY)!)).toEqual({
      completed: 1,
      finished: false,
    });
    expect(pushMock).not.toHaveBeenCalledWith("/");
  });
});

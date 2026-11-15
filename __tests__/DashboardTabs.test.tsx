// Dashboard tabs + dashboard page notice.
//   - Switching tabs scrolls the tab row into view AFTER the new
//     section has rendered, so every tab lands in the same place (see
//     the effect in components/DashboardTabs.tsx). Scrolling in the
//     click handler ran against the old tab's layout, so each tab
//     landed somewhere else.
//   - The dashboard page no longer shows the pink "Sample demo data"
//     notice box at the top (app/dashboard/page.tsx); the Test Admin
//     Mode banner and the footer note stay.
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardTabs from "@/components/DashboardTabs";
import DashboardPage from "@/app/dashboard/page";

// NOTE: jest.mock needs the relative path here — the "@/lib/..."
// form fails to resolve at mock-registration time in this repo's
// Jest setup (a plain import of the same path resolves fine). The
// mock still applies to the page's "@/lib/..." import: Jest matches
// mocks by resolved file.
jest.mock("../lib/auth/demo", () => ({
  getDemoOrSession: jest.fn(async () => ({ demo: true, session: null })),
}));
jest.mock("../lib/auth/server", () => ({
  isAuthConfigured: jest.fn(() => true),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/dashboard",
}));

// What the scroll saw at the moment it ran: the target, the options,
// and whether each panel was already hidden or shown. If the scroll
// ran before the new panel rendered, the new panel is still hidden
// at call time — that is the bug.
type ScrollCall = {
  target: Element;
  options: ScrollIntoViewOptions | undefined;
  salesHidden: boolean | null;
  payrollHidden: boolean | null;
};
const scrollCalls: ScrollCall[] = [];

function renderTabs() {
  return render(
    <DashboardTabs>
      <section id="sales">
        <h2>Sales</h2>
        <p>Sales content.</p>
      </section>
      <section id="payroll">
        <h2>Payroll</h2>
        <p>Payroll content.</p>
      </section>
      <footer>
        <p>Footer note.</p>
      </footer>
    </DashboardTabs>,
  );
}

beforeEach(() => {
  scrollCalls.length = 0;
  Element.prototype.scrollIntoView = jest.fn(function (
    this: Element,
    options?: ScrollIntoViewOptions,
  ) {
    scrollCalls.push({
      target: this,
      options,
      salesHidden:
        document.getElementById("dash-panel-sales")?.hasAttribute("hidden") ??
        null,
      payrollHidden:
        document
          .getElementById("dash-panel-payroll")
          ?.hasAttribute("hidden") ?? null,
    });
  });
});

describe("dashboard tab scroll", () => {
  it("does not scroll on mount", () => {
    renderTabs();
    expect(scrollCalls).toHaveLength(0);
  });

  it("scrolls the nav into view after the Payroll panel is shown", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Payroll" }));

    expect(screen.getByRole("tab", { name: "Payroll" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      document.getElementById("dash-panel-payroll"),
    ).not.toHaveAttribute("hidden");
    expect(document.getElementById("dash-panel-sales")).toHaveAttribute(
      "hidden",
    );

    expect(scrollCalls).toHaveLength(1);
    expect(scrollCalls[0].target.getAttribute("role")).toBe("tablist");
    expect(scrollCalls[0].options).toEqual({
      behavior: "auto",
      block: "start",
    });
    // The scroll ran after the render: the new panel was already
    // visible when scrollIntoView was called.
    expect(scrollCalls[0].payrollHidden).toBe(false);
    expect(scrollCalls[0].salesHidden).toBe(true);
  });

  it("scrolls the nav into view after the Sales panel is shown", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Payroll" }));
    fireEvent.click(screen.getByRole("tab", { name: "Sales" }));

    expect(
      document.getElementById("dash-panel-sales"),
    ).not.toHaveAttribute("hidden");
    expect(document.getElementById("dash-panel-payroll")).toHaveAttribute(
      "hidden",
    );

    expect(scrollCalls).toHaveLength(2);
    expect(scrollCalls[1].target.getAttribute("role")).toBe("tablist");
    expect(scrollCalls[1].options).toEqual({
      behavior: "auto",
      block: "start",
    });
    expect(scrollCalls[1].salesHidden).toBe(false);
    expect(scrollCalls[1].payrollHidden).toBe(true);
  });

  it("clicking the already-active tab still scrolls the nav into view", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Payroll" }));
    fireEvent.click(screen.getByRole("tab", { name: "Payroll" }));

    expect(scrollCalls).toHaveLength(2);
    expect(scrollCalls[1].options).toEqual({
      behavior: "auto",
      block: "start",
    });
  });

  it("keyboard navigation also scrolls after the new panel renders", () => {
    renderTabs();
    const payrollTab = screen.getByRole("tab", { name: "Payroll" });
    payrollTab.focus();
    // ArrowRight from Payroll moves to Taxes (the next tab).
    fireEvent.keyDown(payrollTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Taxes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(scrollCalls).toHaveLength(1);
    expect(scrollCalls[0].target.getAttribute("role")).toBe("tablist");
    expect(scrollCalls[0].options).toEqual({
      behavior: "auto",
      block: "start",
    });
  });
});

describe("dashboard page notice", () => {
  it("no longer shows the top 'Sample demo data' notice box", async () => {
    render(await DashboardPage());

    // The box's distinctive text is gone.
    expect(screen.queryByText(/Figures as of/)).toBeNull();
    expect(screen.queryByText(/Every table sorts/)).toBeNull();
    // The only role="note" left is the Test Admin Mode banner.
    const notes = screen.getAllByRole("note");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toHaveTextContent("Test Admin Mode");
    expect(notes[0]).toHaveTextContent("Exit Test Admin Mode");
    // The small footer note stays.
    expect(screen.getByText(/Change the seed rows/)).toBeInTheDocument();
    // The tabs themselves are still there.
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Payroll" }),
    ).toBeInTheDocument();
  });
});

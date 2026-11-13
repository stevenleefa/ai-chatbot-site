// components/DealsClient.tsx — the deal cards on /deals with their
// QR codes and the coupon dialog. The ?coupon= param a scanned QR
// lands on opens the dialog on mount; tapping a QR code or "Show
// coupon" opens the same dialog; closing drops the param.
//
// jsdom does not implement <dialog> showModal, so this file
// polyfills it (open attribute + close event) the way the real
// browser behaves — the component itself uses the plain native API.
import { render, screen, fireEvent } from "@testing-library/react";
import DealsClient from "@/components/DealsClient";

const mockState = { search: "", replace: jest.fn() };

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockState.search),
  useRouter: () => ({ replace: mockState.replace }),
}));

beforeEach(() => {
  mockState.search = "";
  mockState.replace.mockClear();
  HTMLDialogElement.prototype.showModal = jest.fn(function (
    this: HTMLDialogElement
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = jest.fn(function (
    this: HTMLDialogElement
  ) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

describe("DealsClient", () => {
  it("renders every deal with a QR code and a Show coupon button", () => {
    const { container } = render(<DealsClient />);
    expect(screen.getByText("First visit — 20% off any haircut")).toBeInTheDocument();
    expect(screen.getByText("Student discount — 10% off")).toBeInTheDocument();
    expect(container.querySelectorAll(".deal-qr svg")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Show coupon" })).toHaveLength(4);
  });

  it("each card pins the QR code and Show coupon button in a footer at the bottom", () => {
    const { container } = render(<DealsClient />);
    const cards = container.querySelectorAll("article.deal-card");
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      const footer = card.querySelector(".deal-card-footer");
      expect(footer).not.toBeNull();
      expect(footer!.querySelector(".deal-qr")).not.toBeNull();
      expect(footer!.querySelector(".deal-coupon-btn")).not.toBeNull();
      // The footer is the last child of the card, so with the
      // card's flex column + margin-top: auto it sits at the
      // bottom, and the footer's centred column centres both
      // controls — the QR and the button line up across cards even
      // though the text above varies in length.
      expect(card.lastElementChild).toBe(footer);
    });
  });

  it("Show coupon opens the dialog with that deal's code, focused on Close", () => {
    render(<DealsClient />);
    fireEvent.click(screen.getAllByRole("button", { name: "Show coupon" })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("LUMEN20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("tapping the QR code opens the same dialog", () => {
    render(<DealsClient />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show coupon for Weekday colour — 15% off",
      })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("WEEKDAY15")).toBeInTheDocument();
  });

  it("?coupon= opens that deal's coupon on mount", () => {
    mockState.search = "coupon=LUMEN20";
    render(<DealsClient />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("LUMEN20")).toBeInTheDocument();
  });

  it("an unknown ?coupon= opens no dialog", () => {
    mockState.search = "coupon=NOPE";
    render(<DealsClient />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closing the dialog drops the ?coupon= param and returns focus to the trigger", () => {
    render(<DealsClient />);
    const trigger = screen.getAllByRole("button", { name: "Show coupon" })[0];
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockState.replace).toHaveBeenCalledWith("/deals", {
      scroll: false,
    });
    expect(trigger).toHaveFocus();
  });
});

// components/ChatWidget.tsx — the "Ask Lumen" chat. Tests the
// header-nav wiring: the "Assistant" nav item opens the chat via
// the "lumen:open-assistant" window event, clicking another header
// nav link closes it, and closing (Escape or the ✕ button) returns
// focus to the "Ask Lumen" button. Sending a message is not tested
// here (it calls /api/chat).
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatWidget from "@/components/ChatWidget";

function openChat() {
  fireEvent.click(screen.getByRole("button", { name: "Ask Lumen" }));
}

describe("ChatWidget", () => {
  it("opens on the Ask Lumen button and focuses the question box", () => {
    render(<ChatWidget />);
    openChat();
    expect(screen.getByText("Lumen assistant")).toBeInTheDocument();
    expect(screen.getByLabelText("Ask the assistant")).toHaveFocus();
  });

  it("opens when the lumen:open-assistant window event fires", () => {
    render(<ChatWidget />);
    // A raw window event is outside React's event system, so the
    // dispatch needs act() for the state update to flush.
    act(() => {
      window.dispatchEvent(new Event("lumen:open-assistant"));
    });
    expect(screen.getByText("Lumen assistant")).toBeInTheDocument();
    expect(screen.getByLabelText("Ask the assistant")).toHaveFocus();
  });

  it("stays open when the open event fires again while it is open", () => {
    render(<ChatWidget />);
    openChat();
    act(() => {
      window.dispatchEvent(new Event("lumen:open-assistant"));
    });
    expect(screen.getByText("Lumen assistant")).toBeInTheDocument();
  });

  it("closes when a link inside the header nav is clicked", () => {
    render(
      <div>
        <div className="site-nav">
          <a href="#services">Services</a>
        </div>
        <ChatWidget />
      </div>
    );
    openChat();
    expect(screen.getByText("Lumen assistant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Services" }));
    expect(screen.queryByText("Lumen assistant")).not.toBeInTheDocument();
  });

  it("Escape closes it and returns focus to the Ask Lumen button", () => {
    render(<ChatWidget />);
    openChat();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Lumen assistant")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask Lumen" })).toHaveFocus();
  });

  it("the close button closes it and returns focus to the Ask Lumen button", () => {
    render(<ChatWidget />);
    openChat();
    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
    expect(screen.queryByText("Lumen assistant")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask Lumen" })).toHaveFocus();
  });

  it("closes when clicking outside the chat panel", () => {
    render(<ChatWidget />);
    openChat();
    expect(screen.getByText("Lumen assistant")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Lumen assistant")).not.toBeInTheDocument();
    // Focus stays where the visitor clicked — it does not jump back
    // to the "Ask Lumen" button (unlike the Escape/✕ close).
    expect(screen.getByRole("button", { name: "Ask Lumen" })).not.toHaveFocus();
  });

  it("stays open when clicking inside the chat panel", () => {
    render(<ChatWidget />);
    openChat();
    fireEvent.mouseDown(screen.getByLabelText("Ask the assistant"));
    expect(screen.getByText("Lumen assistant")).toBeInTheDocument();
  });

  it("stays open when the Assistant nav button is mousedowned", () => {
    render(
      <div>
        <button type="button" data-open-assistant>
          Assistant
        </button>
        <ChatWidget />
      </div>
    );
    openChat();
    // The Assistant button's click dispatches lumen:open-assistant,
    // which reopens the chat — so its mousedown must not close it
    // first, or the open would fight the close.
    fireEvent.mouseDown(screen.getByRole("button", { name: "Assistant" }));
    expect(screen.getByText("Lumen assistant")).toBeInTheDocument();
  });
});

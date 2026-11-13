// components/AssistantNavLink.tsx — the "Assistant" item in the
// fixed header nav. It is a button (not a link) that opens the
// Lumen Assistant chat by dispatching the "lumen:open-assistant"
// window event, which components/ChatWidget.tsx listens for.
import { render, screen, fireEvent } from "@testing-library/react";
import AssistantNavLink from "@/components/AssistantNavLink";

describe("AssistantNavLink", () => {
  it("dispatches lumen:open-assistant when clicked", () => {
    const handler = jest.fn();
    window.addEventListener("lumen:open-assistant", handler);
    render(<AssistantNavLink />);
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("lumen:open-assistant", handler);
  });
});

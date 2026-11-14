// ChatWidget voice tests (components/ChatWidget.tsx). The
// greeting by name, and the speech controls hiding where the Web
// Speech APIs do not exist (jsdom has neither, so no mic or
// speaker button renders here). The live speech APIs themselves
// need a real browser — see AI_ENGINEER.md.
import { render, screen, fireEvent } from "@testing-library/react";
import ChatWidget, { greetingFor } from "@/components/ChatWidget";

function openChat() {
  fireEvent.click(screen.getByRole("button", { name: "Ask Lumen" }));
}

describe("greetingFor", () => {
  it("greets a signed-in customer by name and mentions the tour", () => {
    expect(greetingFor("Alex Rivera")).toContain("Hi Alex Rivera");
    expect(greetingFor("Alex Rivera")).toContain("guided tour");
  });

  it("uses the generic greeting when signed out", () => {
    expect(greetingFor(null)).toContain("Hi!");
    expect(greetingFor(undefined)).toContain("Lumen Hair Studio");
  });
});

describe("ChatWidget voice", () => {
  it("greets the signed-in customer by name when opened", () => {
    render(<ChatWidget displayName="Alex Rivera" />);
    openChat();
    expect(screen.getByText(/Hi Alex Rivera/)).toBeInTheDocument();
  });

  it("uses the generic greeting when signed out", () => {
    render(<ChatWidget />);
    openChat();
    expect(screen.getByText(/Hi! Ask me about services/)).toBeInTheDocument();
    expect(screen.getByText(/guided tour/)).toBeInTheDocument();
  });

  it("shows no speaker toggle or microphone button where speech is unsupported", () => {
    render(<ChatWidget />);
    openChat();
    expect(
      screen.queryByRole("button", { name: /spoken replies/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /speak your question/i })
    ).not.toBeInTheDocument();
    // Text chat is unaffected: the input and Send still work.
    expect(screen.getByLabelText("Ask the assistant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});

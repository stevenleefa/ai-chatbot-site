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

  it("speaks replies with the customer's chosen voice, speed and pitch", async () => {
    // Mock the speech APIs (jsdom has neither) and the utterance
    // constructor, so the widget thinks speaking is supported.
    const voices = [
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
      { voiceURI: "google-us", name: "Google US English", lang: "en-US" },
    ];
    const speak = jest.fn();
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: jest.fn(() => voices),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        cancel: jest.fn(),
        speak,
      },
      configurable: true,
      writable: true,
    });
    class MockUtterance {
      text: string;
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    global.SpeechSynthesisUtterance =
      MockUtterance as unknown as typeof SpeechSynthesisUtterance;
    window.localStorage.setItem(
      "lumen-preferences",
      JSON.stringify({
        voiceURI: "samantha",
        voiceRate: 1.25,
        voicePitch: 0.75,
      }),
    );
    render(<ChatWidget displayName="Alex Rivera" />);
    openChat();
    // The greeting is a bot message, so opening the chat speaks it.
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as {
      text: string;
      voice: { name: string } | null;
      rate: number;
      pitch: number;
    };
    expect(utterance.text).toContain("Hi Alex Rivera");
    expect(utterance.voice?.name).toBe("Samantha");
    expect(utterance.rate).toBe(1.25);
    expect(utterance.pitch).toBe(0.75);
    // @ts-expect-error — deleting window globals for the test.
    delete window.speechSynthesis;
    // @ts-expect-error — deleting a global for the test.
    delete global.SpeechSynthesisUtterance;
    window.localStorage.clear();
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

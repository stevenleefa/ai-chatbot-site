// Speech helper tests (lib/speech.ts). Only the pure parts are
// tested: feature detection (false in jsdom — neither Web Speech
// API exists here) and the markdown stripping for spoken replies.
// The live SpeechRecognition / speechSynthesis objects are never
// tested here — there is no microphone in this workspace.
import {
  VOICE_UNAVAILABLE_MESSAGE,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  stripMarkdownForSpeech,
} from "@/lib/speech";

describe("speech feature detection", () => {
  it("reports both speech APIs as unsupported in this environment", () => {
    expect(isSpeechSynthesisSupported()).toBe(false);
    expect(isSpeechRecognitionSupported()).toBe(false);
    expect(getSpeechRecognitionConstructor()).toBeNull();
  });
});

describe("stripMarkdownForSpeech", () => {
  it("removes asterisks, hashes and backticks", () => {
    expect(stripMarkdownForSpeech("**Haircut** costs $35")).toBe(
      "Haircut costs $35"
    );
    expect(stripMarkdownForSpeech("# Services\n`code`")).toBe("Services code");
  });

  it("turns markdown links into their label and drops bare URLs", () => {
    expect(
      stripMarkdownForSpeech("See [the shop](/products) for more")
    ).toBe("See the shop for more");
    expect(
      stripMarkdownForSpeech("Visit https://example.com for details")
    ).toBe("Visit for details");
  });

  it("collapses extra whitespace and trims", () => {
    expect(stripMarkdownForSpeech("  Hi   there  ")).toBe("Hi there");
  });
});

describe("VOICE_UNAVAILABLE_MESSAGE", () => {
  it("is the plain fallback the widget shows", () => {
    expect(VOICE_UNAVAILABLE_MESSAGE).toContain("type instead");
  });
});

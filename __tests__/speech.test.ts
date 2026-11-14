// Speech helper tests (lib/speech.ts). Only the pure parts are
// tested: feature detection (false in jsdom — neither Web Speech
// API exists here) and the markdown stripping for spoken replies.
// The live SpeechRecognition / speechSynthesis objects are never
// tested here — there is no microphone in this workspace.
import {
  VOICE_UNAVAILABLE_MESSAGE,
  applyVoiceSettings,
  clampVoiceValue,
  findVoiceByUri,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  stripMarkdownForSpeech,
} from "@/lib/speech";

// A stand-in voice: only the fields the resolution reads.
function makeVoice(
  overrides: Partial<SpeechSynthesisVoice>,
): SpeechSynthesisVoice {
  return {
    voiceURI: "com.example.voice",
    name: "Example Voice",
    lang: "en-US",
    localService: true,
    default: false,
    ...overrides,
  } as SpeechSynthesisVoice;
}

// A stand-in utterance: only the fields applyVoiceSettings writes.
function makeUtterance(): SpeechSynthesisUtterance {
  return {
    voice: null,
    rate: 1,
    pitch: 1,
  } as unknown as SpeechSynthesisUtterance;
}

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

describe("clampVoiceValue", () => {
  it("passes numbers inside 0.5–2 through unchanged", () => {
    expect(clampVoiceValue(0.75)).toBe(0.75);
    expect(clampVoiceValue(1)).toBe(1);
    expect(clampVoiceValue(1.25)).toBe(1.25);
    expect(clampVoiceValue(2)).toBe(2);
  });

  it("clamps out-of-range numbers to the ends of the range", () => {
    expect(clampVoiceValue(0.1)).toBe(0.5);
    expect(clampVoiceValue(5)).toBe(2);
  });

  it("turns non-numbers into the normal value 1, never throws", () => {
    expect(clampVoiceValue("fast")).toBe(1);
    expect(clampVoiceValue(null)).toBe(1);
    expect(clampVoiceValue(undefined)).toBe(1);
    expect(clampVoiceValue(NaN)).toBe(1);
  });
});

describe("findVoiceByUri", () => {
  const voices = [
    makeVoice({ voiceURI: "samantha", name: "Samantha", lang: "en-US" }),
    makeVoice({ voiceURI: "google-us", name: "Google US English", lang: "en-US" }),
    makeVoice({ voiceURI: "", name: "Nameless Voice", lang: "en-GB" }),
  ];

  it("finds a voice by its exact voiceURI", () => {
    expect(findVoiceByUri(voices, "samantha")?.name).toBe("Samantha");
  });

  it("falls back to matching by name when the voiceURI does not match", () => {
    // A voice stored by name (it had no voiceURI when picked).
    expect(findVoiceByUri(voices, "Google US English")?.voiceURI).toBe(
      "google-us",
    );
    // A voice whose voiceURI is empty, stored by name.
    expect(findVoiceByUri(voices, "Nameless Voice")?.lang).toBe("en-GB");
  });

  it("returns null when nothing matches, and for a null/empty choice", () => {
    expect(findVoiceByUri(voices, "no-such-voice")).toBeNull();
    expect(findVoiceByUri(voices, null)).toBeNull();
    expect(findVoiceByUri(voices, "")).toBeNull();
    expect(findVoiceByUri([], "samantha")).toBeNull();
  });
});

describe("applyVoiceSettings", () => {
  const voices = [
    makeVoice({ voiceURI: "samantha", name: "Samantha", lang: "en-US" }),
    makeVoice({ voiceURI: "google-us", name: "Google US English", lang: "en-US" }),
    makeVoice({ voiceURI: "marie", name: "Marie", lang: "fr-FR" }),
  ];

  it("uses the chosen voice, rate and pitch when the voice exists", () => {
    const u = makeUtterance();
    applyVoiceSettings(u, "samantha", 1.25, 0.75, voices);
    expect(u.voice?.name).toBe("Samantha");
    expect(u.rate).toBe(1.25);
    expect(u.pitch).toBe(0.75);
  });

  it("falls back to the first English voice when the chosen voice is gone", () => {
    const u = makeUtterance();
    applyVoiceSettings(u, "a-voice-from-another-device", 1, 1, voices);
    expect(u.voice?.name).toBe("Samantha");
  });

  it("falls back to the first English voice when no voice is chosen", () => {
    const u = makeUtterance();
    applyVoiceSettings(u, null, 1, 1, voices);
    expect(u.voice?.name).toBe("Samantha");
  });

  it("leaves the voice unset when there is no voice at all", () => {
    const u = makeUtterance();
    applyVoiceSettings(u, null, 1, 1, []);
    expect(u.voice).toBeNull();
  });

  it("clamps rate and pitch to the valid range", () => {
    const u = makeUtterance();
    applyVoiceSettings(u, null, 0.1, 9, voices);
    expect(u.rate).toBe(0.5);
    expect(u.pitch).toBe(2);
  });
});

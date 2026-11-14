// Voice helpers for the chat assistant — Web Speech API.
//
// Both speech APIs are browser-only and unevenly supported
// (Safari's speech recognition is limited), so everything here
// feature-detects first and the text chat is always the fallback.
// Nothing in this file touches the network or the server: it only
// reads window globals and strips markdown for speaking. Pure
// helpers are unit-tested (see __tests__/speech.test.ts); the live
// SpeechRecognition / speechSynthesis objects are never tested
// here — there is no microphone in this workspace.

// The Web Speech recognition interface, minimal shape: only the
// members the chat widget uses. The constructor lives on window as
// SpeechRecognition (Chrome/Edge) or webkitSpeechRecognition
// (Safari, where it may exist but refuse to start).
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// One result row: the transcript alternatives, first is best.
export interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

function getWindow(): (Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}) | null {
  if (typeof window === "undefined") return null;
  return window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
}

// Text-to-speech is available when speechSynthesis exists.
export function isSpeechSynthesisSupported(): boolean {
  const w = getWindow();
  return Boolean(w && "speechSynthesis" in w && w.speechSynthesis);
}

// Speech-to-text is available when either constructor exists.
// (Supported does not mean it will work: Safari may expose the
// constructor and still refuse, so the widget shows the plain
// fallback message on any recognition error.)
export function isSpeechRecognitionSupported(): boolean {
  const w = getWindow();
  return Boolean(w && (w.SpeechRecognition ?? w.webkitSpeechRecognition));
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = getWindow();
  if (!w) return null;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Strip markdown before speaking: asterisks, hashes, backticks and
// link markup sound like nothing, and a raw URL read aloud is
// noise. Plain text in, plain text out.
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [label](url) -> label
    .replace(/[*#`_~]+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Assistant voice options (Display settings → Voice) ------------------
// The customer picks a voice (by voiceURI, or by name when the voice
// has no voiceURI), a rate and a pitch. The voice list comes from
// the browser, so it differs by browser and OS — and a voice picked
// on one device may not exist on another. Resolution is therefore
// forgiving: exact voiceURI first, then the same name, then no
// voice (the browser default, which the widget's English fallback
// covers). Nothing here throws; a missing voice just means the
// default voice speaks.

/** Clamp a rate/pitch to the valid range (0.5–2); non-numbers become 1. */
export function clampVoiceValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0.5, value));
}

/**
 * Find a voice by the stored identifier: the voiceURI first, then
 * the same name (for voices stored by name because they had no
 * voiceURI). Returns null when nothing matches — the caller then
 * uses the browser default voice.
 */
export function findVoiceByUri(
  voices: SpeechSynthesisVoice[],
  voiceURI: string | null | undefined,
): SpeechSynthesisVoice | null {
  if (!voiceURI) return null;
  const byUri = voices.find((v) => v.voiceURI === voiceURI);
  if (byUri) return byUri;
  const byName = voices.find((v) => v.name === voiceURI);
  return byName ?? null;
}

/**
 * Apply the customer's voice choices to an utterance. The chosen
 * voice wins when it exists in this browser; otherwise the first
 * English voice is used (the widget's long-standing default), and
 * when there is no English voice either the browser default speaks.
 * Rate and pitch are clamped to the valid range. Safe to call with
 * an empty voices list — the utterance just keeps its defaults.
 */
export function applyVoiceSettings(
  utterance: SpeechSynthesisUtterance,
  voiceURI: string | null | undefined,
  rate: unknown,
  pitch: unknown,
  voices: SpeechSynthesisVoice[],
): void {
  const chosen = findVoiceByUri(voices, voiceURI);
  if (chosen) {
    utterance.voice = chosen;
  } else {
    const english = voices.find((v) => v.lang?.startsWith("en"));
    if (english) utterance.voice = english;
  }
  utterance.rate = clampVoiceValue(rate);
  utterance.pitch = clampVoiceValue(pitch);
}

// The plain-language fallback the widget shows when voice input
// cannot start (unsupported browser, or the visitor refused the
// microphone). Text chat keeps working either way.
export const VOICE_UNAVAILABLE_MESSAGE =
  "Voice input isn't available in this browser — type instead.";

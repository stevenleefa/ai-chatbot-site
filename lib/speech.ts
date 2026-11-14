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

// The plain-language fallback the widget shows when voice input
// cannot start (unsupported browser, or the visitor refused the
// microphone). Text chat keeps working either way.
export const VOICE_UNAVAILABLE_MESSAGE =
  "Voice input isn't available in this browser — type instead.";

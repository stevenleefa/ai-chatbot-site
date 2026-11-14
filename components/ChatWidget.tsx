"use client";

import { useState, useEffect, useRef } from "react";
import type { ChatAction } from "@/lib/tools";
import { applyCartActionToStorage } from "@/lib/chat-cart";
import {
  applyVoiceSettings,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  stripMarkdownForSpeech,
  VOICE_UNAVAILABLE_MESSAGE,
  type SpeechRecognitionLike,
} from "@/lib/speech";
import { readStoredPreferences } from "@/lib/personalization";

type Msg = { role: "user" | "bot"; text: string; sources?: string[]; action?: ChatAction };

const SUGGESTED = [
  "What are your opening hours?",
  "How much is a haircut?",
  "How do I book an appointment?",
  "Is Saturday free?",
];

// The opening line. Signed in, the assistant greets the customer
// by name (the name comes from the server session via the
// displayName prop — never from client input). Either way it
// mentions the guided tour, which the visitor starts from the
// hamburger menu; the tour never auto-starts.
export function greetingFor(displayName?: string | null): string {
  const tourNote = "You can also take a guided tour from the menu.";
  if (displayName) {
    return `Hi ${displayName} — how can I help? Ask about services, prices, hours, booking or products. ${tourNote}`;
  }
  return `Hi! Ask me about services, prices, hours or booking at Lumen Hair Studio. ${tourNote}`;
}

// One-line rendering of a structured action (see lib/tools.ts):
// a booking confirmation, a free-slots summary, or a cart add,
// under the reply text. The text itself already carries the
// details — this is the glanceable version.
function actionLine(action: ChatAction): string | null {
  if (action.type === "booking_created") {
    return (
      `✓ Booking requested: ${action.service} · ${action.date} at ${action.time} with ${action.stylist}` +
      (action.saved ? "" : " (demo mode — not saved yet)")
    );
  }
  if (action.type === "availability") {
    const free = action.free.filter((f) => f.times.length > 0);
    if (free.length === 0) return null;
    return `Free ${action.dayLabel}: ` + free.map((f) => `${f.stylist} ${f.times.join(", ")}`).join(" · ");
  }
  if (action.type === "cart_added") {
    return `✓ Added to cart: ${action.productName} × ${action.quantity} (${action.unitPrice} each)`;
  }
  return null;
}

export default function ChatWidget({
  displayName,
}: {
  // Signed-in user's display name, from the server session in
  // app/layout.tsx. Null/undefined when signed out.
  displayName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: greetingFor(displayName) },
  ]);
  // Voice support is detected on mount (window only exists in the
  // browser — the server render has neither API, so these start
  // false and the buttons appear only where the APIs exist).
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  // Set when the chat is closed by Escape or the ✕ button: focus
  // must return to the "Ask Lumen" button, but that button only
  // exists once the chat is closed, so the return has to wait for
  // the re-render (see the [open] effect below). A nav-link close
  // (Task D) does NOT set this — focus stays where the user clicked.
  const returnFocusRef = useRef(false);
  // Index of the last bot message already spoken, so a re-render
  // never re-speaks it (and reopening the chat stays silent).
  const spokenIndexRef = useRef(-1);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);

  // Feature-detect the two speech APIs once, on mount. Speaking
  // defaults ON where it is supported, OFF where it is not (and
  // the toggle is hidden there entirely).
  useEffect(() => {
    const tts = isSpeechSynthesisSupported();
    setSpeechSupported(tts);
    setSpeakOn(tts);
    setRecognitionSupported(isSpeechRecognitionSupported());
  }, []);

  // Warm the voice list: browsers load voices asynchronously, and
  // speaking before they arrive can come out in the wrong voice or
  // not at all. getVoices() on voiceschanged is the standard way
  // to make sure the list is populated.
  useEffect(() => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    function loadVoices() {
      synth.getVoices();
    }
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => synth.removeEventListener("voiceschanged", loadVoices);
  }, [speechSupported]);

  function speak(text: string) {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    // A new reply replaces whatever is still being read out.
    synth.cancel();
    const clean = stripMarkdownForSpeech(text);
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    // The customer's voice choices (Display settings → Voice),
    // read fresh from localStorage so a change made on /my-account
    // applies to the next reply even while the chat is open. A
    // voice picked on another device falls back to the first
    // English voice (or the browser default) — never an error.
    const prefs = readStoredPreferences();
    applyVoiceSettings(
      utterance,
      prefs.voiceURI,
      prefs.voiceRate,
      prefs.voicePitch,
      synth.getVoices(),
    );
    synth.speak(utterance);
  }

  // Speak each new bot reply while speaking is on. The greeting is
  // spoken too, the first time the chat opens.
  useEffect(() => {
    if (!open || !speakOn || !speechSupported) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "bot") return;
    if (messages.length - 1 <= spokenIndexRef.current) return;
    spokenIndexRef.current = messages.length - 1;
    speak(last.text);
    // speak() is stable by construction; messages/speakOn/open are
    // the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, open, speakOn, speechSupported]);

  // Closing the chat stops any speech in progress; turning
  // speaking off does the same.
  useEffect(() => {
    if (!open && speechSupported) window.speechSynthesis.cancel();
  }, [open, speechSupported]);
  useEffect(() => {
    if (!speakOn && speechSupported) window.speechSynthesis.cancel();
  }, [speakOn, speechSupported]);

  // Stop listening (microphone off) and clear the state. Used by
  // the mic toggle, by Escape, and by the recognition callbacks.
  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped — nothing to do.
    }
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
  }

  // Start speech-to-text. While listening, interim results show
  // live in the question box; a final result is sent straight
  // away. Any error (no microphone permission, unsupported
  // browser, Safari refusing) shows the plain fallback message
  // and the text chat keeps working.
  function startListening() {
    setVoiceError(null);
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      setVoiceError(VOICE_UNAVAILABLE_MESSAGE);
      return;
    }
    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      setVoiceError(VOICE_UNAVAILABLE_MESSAGE);
      return;
    }
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText.trim()) {
        stopListening();
        send(finalText.trim());
      } else if (interim) {
        setInput(interim);
      }
    };
    recognition.onerror = (event) => {
      stopListening();
      // "no-speech" / "aborted" just mean nothing was heard — no
      // message needed. Anything else means voice input cannot
      // work here, so say so plainly and leave the text chat.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setVoiceError(VOICE_UNAVAILABLE_MESSAGE);
      }
    };
    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      stopListening();
      setVoiceError(VOICE_UNAVAILABLE_MESSAGE);
    }
  }

  // Stop listening when the chat closes, so the microphone never
  // stays live behind a closed panel.
  useEffect(() => {
    if (!open) stopListening();
    // stopListening is stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  // Header nav control (components/AssistantNavLink.tsx +
  // components/SiteNav.tsx): the "Assistant" nav item dispatches
  // "lumen:open-assistant" and the chat opens — from any page, since
  // the widget is mounted in app/layout.tsx. Clicking any other
  // header nav link (brand, Services, Products, Reviews, Booking,
  // a search result, or a hamburger-menu link — all anchors inside
  // .site-nav) closes the chat. The Assistant control is a <button>,
  // not an anchor, so it never triggers the close; clicks inside
  // the chat itself are outside .site-nav, so typing and sending
  // never close it either. Clicking anywhere else outside the chat
  // panel also closes it — see the mousedown effect below.
  useEffect(() => {
    function onOpenAssistant() {
      setOpen(true);
    }
    function onNavClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest?.("a[href]");
      if (anchor && anchor.closest(".site-nav")) setOpen(false);
    }
    window.addEventListener("lumen:open-assistant", onOpenAssistant);
    document.addEventListener("click", onNavClick);
    return () => {
      window.removeEventListener("lumen:open-assistant", onOpenAssistant);
      document.removeEventListener("click", onNavClick);
    };
  }, []);

  // When the widget opens, put focus in the question box so keyboard
  // users can type straight away. When it closes after Escape or the
  // ✕ button, return focus to the "Ask Lumen" button — which only
  // renders once the chat is closed, so this has to happen here,
  // after the re-render, not in the key/click handler (the ref is
  // still null there, and the old direct focus() call was a no-op
  // that silently dropped focus to <body>).
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      openButtonRef.current?.focus();
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // While listening, Escape stops the microphone first and
        // leaves the chat open — a second Escape closes the chat.
        if (listeningRef.current) {
          stopListening();
          return;
        }
        returnFocusRef.current = true;
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open ]);

  // Clicking anywhere outside the chat panel closes it — in
  // addition to Escape, the ✕ button and the header-nav-link close
  // above. mousedown (not click) so the close happens before the
  // click that would otherwise reopen it. Three exclusions, or the
  // open click would close the chat the same instant it opens:
  // clicks inside the panel itself (typing, buttons, links); the
  // floating "Ask Lumen" button (unmounted while open, but guarded
  // anyway); and the Assistant nav button (data-open-assistant —
  // its click dispatches lumen:open-assistant, which reopens the
  // chat, so closing on its mousedown would fight the open). Like
  // the nav-link close, this does NOT return focus to "Ask Lumen":
  // the visitor clicked somewhere else on purpose, so focus stays
  // where they clicked.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      if (openButtonRef.current?.contains(target)) return;
      if (target.closest?.("[data-open-assistant]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open ]);

  // Track whether the visitor is near the bottom. If they scrolled
  // up to re-read an old message, we should not yank them back down.
  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 100;
  }

  // Auto-scroll only if the visitor is already near the bottom
  // (stickToBottomRef), whenever a message arrives, the "Thinking…"
  // indicator appears/disappears, or the widget is opened.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    // The visitor just asked something, so jump to their answer.
    stickToBottomRef.current = true;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setVoiceError(null);
    setBusy(true);
    // A new reply replaces any speech still in progress.
    if (speechSupported) window.speechSynthesis.cancel();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      const botMsg: Msg = {
        role: "bot",
        text: data.answer,
        sources: data.sources,
        action: data.action,
      };
      if (data.action?.type === "cart_added") {
        // The server validated the add and returned the structured
        // action; the cart itself lives in localStorage, so this
        // client writes it — re-validating against the catalogue
        // first (see lib/chat-cart.ts). If the write fails, say so
        // in the chat instead of claiming the product is in the cart.
        const result = applyCartActionToStorage({
          productId: data.action.productId,
          quantity: data.action.quantity,
        });
        if (result.ok) {
          setMessages((m) => [...m, botMsg]);
        } else {
          setMessages((m) => [...m, botMsg, { role: "bot", text: result.message }]);
        }
      } else {
        setMessages((m) => [...m, botMsg]);
      }
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, something went wrong. Please try again or call the studio." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-widget">
      {!open && (
        <button
          ref={openButtonRef}
          className="chat-open"
          onClick={() => setOpen(true)}
          aria-expanded="false"
          aria-controls="chat-box"
        >
          Ask Lumen <span aria-hidden="true">💬</span>
        </button>
      )}
      {open && (
        <div className="chat-box" id="chat-box" ref={panelRef}>
          <div className="chat-head">
            <strong>Lumen assistant</strong>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => setSpeakOn((was) => !was)}
                  aria-label={speakOn ? "Turn spoken replies off" : "Turn spoken replies on"}
                  aria-pressed={speakOn}
                  title={speakOn ? "Spoken replies on" : "Spoken replies off"}
                >
                  <span aria-hidden="true">{speakOn ? "🔊" : "🔇"}</span>
                </button>
              )}
              <button
                onClick={() => {
                  returnFocusRef.current = true;
                  setOpen(false);
                }}
                aria-label="Close chat"
              >
                ✕
              </button>
            </span>
          </div>
          <div
            className="chat-messages"
            ref={listRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            tabIndex={0}
          >
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <p>{m.text}</p>
                {m.action && actionLine(m.action) && (
                  <p className="chat-action">{actionLine(m.action)}</p>
                )}
                {m.sources && m.sources.length > 0 && (
                  <small>Sources: {m.sources.join(", ")}</small>
                )}
              </div>
            ))}
            {busy && <div className="msg bot"><p>Thinking…</p></div>}
          </div>
          <div className="chat-suggested">
            {SUGGESTED.map((q) => (
              <button key={q} onClick={() => send(q)}>{q}</button>
            ))}
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about prices, hours, booking…"
              aria-label="Ask the assistant"
            />
            {recognitionSupported && (
              <button
                type="button"
                onClick={() => (listening ? stopListening() : startListening())}
                aria-label={listening ? "Stop listening" : "Speak your question"}
                aria-pressed={listening}
                title={listening ? "Stop listening" : "Speak your question"}
              >
                <span aria-hidden="true">🎙️</span>
              </button>
            )}
            <button type="submit" disabled={busy}>Send</button>
          </form>
          {listening && (
            <p role="status" style={{ padding: "0 12px 12px", margin: 0 }}>
              Listening… Tap the microphone again or press Escape to stop.
            </p>
          )}
          {voiceError && (
            <p role="status" style={{ padding: "0 12px 12px", margin: 0 }}>
              {voiceError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import type { ChatAction } from "@/lib/tools";

type Msg = { role: "user" | "bot"; text: string; sources?: string[]; action?: ChatAction };

const SUGGESTED = [
  "What are your opening hours?",
  "How much is a haircut?",
  "How do I book an appointment?",
  "Is Saturday free?",
];

// One-line rendering of a structured action (see lib/tools.ts):
// a booking confirmation or a free-slots summary, under the reply
// text. The text itself already carries the details — this is the
// glanceable version.
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
  return null;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Hi! Ask me about services, prices, hours or booking at Lumen Hair Studio." },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // When the widget opens, put focus in the question box so keyboard
  // users can type straight away. Escape closes it and returns focus
  // to the button that opened it.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        openButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: data.answer, sources: data.sources, action: data.action }]);
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
        <div className="chat-box" id="chat-box">
          <div className="chat-head">
            <strong>Lumen assistant</strong>
            <button onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
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
            <button type="submit" disabled={busy}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

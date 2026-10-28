"use client";

import { useState, useEffect, useRef } from "react";

type Msg = { role: "user" | "bot"; text: string; sources?: string[] };

const SUGGESTED = [
  "What are your opening hours?",
  "How much is a haircut?",
  "How do I book an appointment?",
  "What is your cancellation policy?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Hi! Ask me about services, prices, hours or booking at Lumen Hair Studio." },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the message list to the newest message whenever a
  // message arrives, the "Thinking…" indicator appears/disappears,
  // or the widget is opened.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
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
      setMessages((m) => [...m, { role: "bot", text: data.answer, sources: data.sources }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, something went wrong. Please try again or call the studio." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-widget">
      {!open && (
        <button className="chat-open" onClick={() => setOpen(true)}>
          Ask Lumen 💬
        </button>
      )}
      {open && (
        <div className="chat-box">
          <div className="chat-head">
            <strong>Lumen assistant</strong>
            <button onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>
          <div className="chat-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <p>{m.text}</p>
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about prices, hours, booking…"
            />
            <button type="submit" disabled={busy}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

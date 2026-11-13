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
        <div className="chat-box" id="chat-box" ref={panelRef}>
          <div className="chat-head">
            <strong>Lumen assistant</strong>
            <button
              onClick={() => {
                returnFocusRef.current = true;
                setOpen(false);
              }}
              aria-label="Close chat"
            >
              ✕
            </button>
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

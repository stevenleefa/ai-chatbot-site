"use client";

// "Assistant" in the fixed header nav (components/SiteNav.tsx). It
// looks exactly like the other nav links (same colour, weight and
// hover underline — see .site-nav-links button in globals.css) but
// it is a button, not a link: clicking it opens the Lumen Assistant
// chat window instead of scrolling to the #assistant section. The
// chat widget (components/ChatWidget.tsx, mounted in app/layout.tsx
// so it exists on every page) listens for the "lumen:open-assistant"
// window event. Clicking it while the chat is already open just
// keeps it open — it never closes the chat.
export default function AssistantNavLink() {
  return (
    <button
      type="button"
      // Hook for the chat widget's outside-click close
      // (components/ChatWidget.tsx): a mousedown on this button must
      // NOT close the chat, or the click that opens it would close
      // it again the same instant.
      data-open-assistant
      onClick={() =>
        window.dispatchEvent(new Event("lumen:open-assistant"))
      }
    >
      Assistant
    </button>
  );
}

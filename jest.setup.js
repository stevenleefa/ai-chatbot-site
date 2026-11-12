// Runs once before every test file: jest-dom's custom matchers
// (toBeInTheDocument, toHaveAttribute, ...) and a matchMedia stub
// (jsdom has none; ThemeToggle reads prefers-color-scheme on mount).
import "@testing-library/jest-dom";

// jsdom has no TextEncoder/TextDecoder, but lib/security.ts uses
// TextEncoder to measure a request body in bytes — polyfill from Node.
const { TextEncoder, TextDecoder } = require("util");
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

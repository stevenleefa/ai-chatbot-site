"use client";

import type { CSSProperties } from "react";
import { checkPassword, isStrongPassword } from "@/lib/password";

// The exact message text, exported so the component and the tests
// can never drift apart.
export const PASSWORD_WEAK_MESSAGE = "Password not strong enough";
export const PASSWORD_STRONG_MESSAGE = "Strong password";

// Visually-hidden text (screen-reader only): the tick/cross is
// aria-hidden, so this state word is what a screen reader announces
// for each requirement.
const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

// Live password strength checklist for the two places a NEW password
// is set (customer sign-up, set-new-password). Renders the four
// requirements with a tick/cross each plus a strength message, and
// updates as the user types — the parent re-renders with the new
// password on every keystroke.
//
// Styling is inline, using the site's own CSS variables, so it reads
// in both light and dark mode with no new stylesheet rules: met items
// and the strong message use --badge-paid-text (the green already
// used for "paid" badges), unmet items use --muted, and the weak
// message uses --rose-text (the colour already used for form
// errors). Every pair is one of the site's WCAG 2.1 AA-verified text
// colours (see ACCESSIBILITY.md). State is never colour alone: each
// item carries a ✓/✗ character and the message is different words.
// No animations, so prefers-reduced-motion needs nothing.
export default function PasswordStrength({
  id,
  password,
}: {
  // The id the parent puts in the password input's aria-describedby,
  // so a screen reader announces the checklist with the field.
  id: string;
  // The current password.
  password: string;
}) {
  const requirements = checkPassword(password);
  const strong = isStrongPassword(password);

  return (
    <div id={id}>
      <p
        aria-live="polite"
        style={{
          margin: "4px 0 8px",
          fontWeight: "bold",
          color: strong
            ? "var(--badge-paid-text)"
            : "var(--rose-text)",
        }}
      >
        {strong ? PASSWORD_STRONG_MESSAGE : PASSWORD_WEAK_MESSAGE}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            style={{
              color: requirement.met
                ? "var(--badge-paid-text)"
                : "var(--muted)",
            }}
          >
            <span aria-hidden="true">
              {requirement.met ? "✓" : "✗"}
            </span>{" "}
            <span style={visuallyHidden}>
              {requirement.met ? "Met: " : "Not met: "}
            </span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

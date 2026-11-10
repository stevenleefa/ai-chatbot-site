"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/auth/browser";

// Ask for a password-reset email. Supabase sends a link straight to
// /auth/update-password, where the browser client exchanges the ?code=
// in the link for a recovery session and the new-password form shows.
// The redirect must be the plain page URL, with no ?next= suffix:
// Supabase matches redirectTo against the Redirect URLs allowlist as
// a full string, so the old /auth/callback?next=/auth/update-password
// did not match the allowlisted /auth/callback and Supabase silently
// fell back to the site homepage instead — the link looked broken.
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  // Env vars are inlined at build time, so this is known at render.
  const authConfigured = getBrowserClient() !== null;

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supabase = getBrowserClient();
    if (!supabase) {
      setError(
        "Auth is not configured yet — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server. See AUTH.md."
      );
      return;
    }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/update-password`,
      }
    );
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    // Say the same thing whether or not the email has an account, so
    // the page cannot be used to probe for registered emails.
    setSent(true);
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Reset your password — Lumen Hair Studio</h1>
      <p>
        <a href="/login">← Back to sign in</a>
      </p>
      {!authConfigured && (
        <p role="alert" style={{ background: "#fff3cd", padding: 12 }}>
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Password reset is
          unavailable until then. See AUTH.md.
        </p>
      )}
      {sent ? (
        <p role="status">
          If an account exists for that email, we have sent a password-reset
          link. Click the link in the email to set a new password.
        </p>
      ) : (
        <form className="lead-form" onSubmit={requestReset}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" style={{ color: "#8e4a56" }}>
          {error}
        </p>
      )}
    </main>
  );
}

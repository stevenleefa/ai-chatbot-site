"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/auth/browser";

// Owner/staff sign-up. The database trigger in supabase/auth-schema.sql
// makes the FIRST account ever created an admin (owner bootstrap); every
// later account starts as staff and must be promoted by an admin on
// /admin. Passwords are handled by Supabase Auth and never stored here.
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Env vars are inlined at build time, so this is known at render.
  const authConfigured = getBrowserClient() !== null;

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) {
      setError(
        "Auth is not configured yet — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server. See AUTH.md."
      );
      return;
    }
    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // Supabase returns an empty identities list when this email already
    // has an account (it does not leak that fact in the message).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError(
        "An account with this email may already exist — try signing in instead."
      );
      return;
    }
    if (data.session) {
      // Email confirmation is off: signed in straight away.
      router.push("/dashboard");
      router.refresh();
      return;
    }
    // Email confirmation is on: no session yet until they click the link.
    setNotice(
      "Check your email to confirm your account. Once you click the confirmation link you will be signed in."
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Create an account — Lumen Hair Studio</h1>
      <p>
        <a href="/">← Back to the site</a>
      </p>
      {!authConfigured && (
        <p role="alert" style={{ background: "#fff3cd", padding: 12 }}>
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-up is unavailable
          until then. See AUTH.md.
        </p>
      )}
      <form className="lead-form" onSubmit={signUp}>
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
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      {error && (
        <p role="alert" style={{ color: "#8e4a56" }}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <p>
        Already have an account? <a href="/login">Sign in</a>
      </p>
      <p>
        <small>
          The first account ever created becomes the owner admin. Later
          accounts start as staff and an admin must promote them on /admin.
        </small>
      </p>
    </main>
  );
}

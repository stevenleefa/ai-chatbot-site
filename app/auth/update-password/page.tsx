"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/auth/browser";
import { isStrongPassword } from "@/lib/password";
import PasswordStrength from "@/components/PasswordStrength";

// Set a new password after following a link from an email. Two ways in:
// - Password reset: the link goes through /auth/callback first, which
//   exchanges ?code= for a session, so a session already exists here.
// - Staff invite: the link lands here directly with the session in the
//   URL hash (#access_token=…&refresh_token=…&type=invite). The
//   server-side invite API sends hash tokens, not ?code=, so the
//   callback cannot handle invites — this page reads the hash and
//   establishes the session itself, then removes the tokens from the
//   address bar. Without a session from either route, this page sends
//   the user back to /login. Serves two cases: a password reset, and an
//   invited staff member setting their first password after accepting
//   an admin invite.
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState("");
  const [done, setDone] = useState(false);
  // The submit button stays disabled until the password passes every
  // strength requirement (see PasswordStrength below) — a weak
  // password cannot be submitted, and the checklist explains why.
  const strong = isStrongPassword(password);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      const supabase = getBrowserClient();
      if (!supabase) {
        router.push("/login?error=setup-incomplete");
        return;
      }
      // Invite links carry the session in the URL hash. Read it and
      // establish the session before checking it — and take the tokens
      // out of the address bar right away, whether they work or not.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const hashError = hash.get("error");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (hashError || accessToken || refreshToken) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
      if (hashError) {
        if (!cancelled) {
          setFatal(
            hash.get("error_description") ||
              "This link is no longer valid. Ask an admin to send a new invite.",
          );
          setReady(true);
        }
        return;
      }
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          if (!cancelled) {
            setFatal(
              "This link is no longer valid. Ask an admin to send a new invite.",
            );
            setReady(true);
          }
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }
      if (!cancelled) setReady(true);
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    // Fallback only — the submit button is already disabled until
    // the password passes every strength requirement (8 characters
    // minimum), so this can only trigger if the gate is bypassed.
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  if (!ready) {
    return (
      <main id="main-content" style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
        <p>Checking your reset link…</p>
      </main>
    );
  }

  return (
    <main id="main-content" style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Choose a new password — Lumen Hair Studio</h1>
      {fatal ? (
        <p role="alert" className="alert-error">
          {fatal} <a href="/login">Back to sign in</a>.
        </p>
      ) : done ? (
        <p role="status">
          Your password has been updated.{" "}
          <a href="/login">Sign in with your new password</a>.
        </p>
      ) : (
        <form className="lead-form" onSubmit={updatePassword}>
          <label>
            New password
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-describedby="password-requirements"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <PasswordStrength
            id="password-requirements"
            password={password}
          />
          <label>
            Confirm new password
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || !strong}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
    </main>
  );
}

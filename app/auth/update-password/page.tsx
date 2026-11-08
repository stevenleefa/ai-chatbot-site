"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/auth/browser";

// Set a new password after following a recovery link. The link goes
// through /auth/callback first, which creates a recovery session —
// without that session this page sends the user back to /login.
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      const supabase = getBrowserClient();
      if (!supabase) {
        router.push("/login?error=setup-incomplete");
        return;
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
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
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
      <main style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
        <p>Checking your reset link…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Choose a new password — Lumen Hair Studio</h1>
      {done ? (
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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
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
          <button type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
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

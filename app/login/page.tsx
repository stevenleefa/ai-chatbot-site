"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/auth/browser";
import { safeRedirect } from "@/lib/security";

// Owner sign-in. After a successful sign-in the user goes to ?next=
// (when they were redirected here from a protected page) or /dashboard.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirect(searchParams.get("next"));
  const urlError = searchParams.get("error");
  // Env vars are inlined at build time, so this is known at render.
  const authConfigured = getBrowserClient() !== null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    urlError === "account-inactive"
      ? "That account is not active, or the auth tables are not set up yet (run supabase/auth-schema.sql). Contact an admin."
      : urlError === "setup-incomplete"
        ? "Auth is not set up yet — run supabase/auth-schema.sql and add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. See AUTH.md."
        : ""
  );

  async function signIn(e: React.FormEvent) {
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Wrong email or password. Try again, or use “Forgot your password?” below."
          : signInError.message
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main id="main-content" style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Owner sign in — Lumen Hair Studio</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      {!authConfigured && (
        <p role="alert" className="alert-note">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-in is unavailable
          until then. See AUTH.md.
        </p>
      )}
      <form className="lead-form" onSubmit={signIn}>
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
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <p>
        <Link href="/auth/reset-password">Forgot your password?</Link>
      </p>
      <p>
        <small>
          Staff accounts are created by admin invitation only. If you
          need access, ask an admin to invite you from /admin.
        </small>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

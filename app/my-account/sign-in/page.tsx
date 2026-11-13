"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/auth/browser";
import { safeRedirect } from "@/lib/security";

// Customer sign-in. After a successful sign-in the customer goes to
// ?next= (when they were redirected here from /my-account) or
// /my-account. Staff who land here by mistake are signed in the same
// way — they land on /my-account and see their own bookings, and the
// header menu still shows them the owner links for their role.
function CustomerSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirect(searchParams.get("next"), "/my-account");
  const authConfigured = getBrowserClient() !== null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
          : signInError.message === "Email not confirmed"
            ? "Please confirm your email first — check your inbox for the confirmation link."
            : signInError.message
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main id="main-content" style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Customer sign in — Lumen Hair Studio</h1>
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
        New here?{" "}
        <Link href="/my-account/sign-up">Create a customer account</Link>
      </p>
      <p>
        <small>
          Staff sign in on the{" "}
          <Link href="/login">owner sign-in page</Link> instead.
        </small>
      </p>
    </main>
  );
}

export default function CustomerSignInPage() {
  return (
    <Suspense>
      <CustomerSignInForm />
    </Suspense>
  );
}

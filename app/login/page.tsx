"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/auth/browser";
import { postSignInDestination } from "@/lib/auth/post-login";
import type { UserRole } from "@/lib/auth/session";

// The single sign-in for everyone: staff, admin and customers sign
// in here with email + password. After a successful sign-in the page
// reads the user's profiles row (RLS: a user reads only their own
// row) and routes by role — staff/admin to /dashboard (or their
// ?next= owner page), customers to /my-account (or their ?next=
// customer page). There is no separate customer sign-in any more:
// /my-account/sign-in redirects here, preserving ?next=.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
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
    if (signInError) {
      setBusy(false);
      setError(
        signInError.message === "Invalid login credentials"
          ? "Wrong email or password. Try again, or use “Forgot your password?” below."
          : signInError.message === "Email not confirmed"
            ? "Please confirm your email first — check your inbox for the confirmation link."
            : signInError.message
      );
      return;
    }
    // The role comes from the profiles row, not from anything the
    // client claims: getUser() confirms the session server-side,
    // and the row is read through RLS (a user reads only their own
    // row). The redirect waits until the role is known — it never
    // guesses. If the row is missing (the trigger did not fire) the
    // account cannot be routed, so show an error instead of
    // sending the user somewhere wrong; the owner pages would treat
    // them as unauthorized anyway.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
      : { data: null };
    setBusy(false);
    const role =
      profile?.role === "admin" ||
      profile?.role === "staff" ||
      profile?.role === "customer"
        ? (profile.role as UserRole)
        : null;
    if (!user || !role) {
      setError(
        "Your account is not set up yet — ask an admin to check your profile, then try again."
      );
      return;
    }
    router.push(postSignInDestination(role, rawNext));
    router.refresh();
  }

  return (
    <main id="main-content" style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Sign in — Lumen Hair Studio</h1>
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
        <Link href="/my-account/sign-up">Create a customer account</Link>{" "}
        to see your bookings and orders.
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

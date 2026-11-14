"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/auth/browser";
import { isStrongPassword } from "@/lib/password";
import { safeRedirect } from "@/lib/security";
import PasswordStrength from "@/components/PasswordStrength";

// Customer sign-up. Anyone can create a customer account — this is
// the one public signup on the site (staff still join by admin invite
// only, see AUTH.md). The account's profile is created by the
// database trigger as 'customer' (supabase/customer-accounts.sql):
// the browser never chooses the role, so a visitor cannot claim
// staff or admin by signing up.
// After sign-up Supabase sends a confirmation email; the link in it
// goes to /auth/callback?next=/my-account, which exchanges the code
// and lands the customer in their area. If email confirmation is
// switched off in Supabase Auth settings, sign-up signs the customer
// straight in instead and both paths below handle it.
function CustomerSignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirect(searchParams.get("next"), "/my-account");
  const authConfigured = getBrowserClient() !== null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  // The submit button stays disabled until the password passes every
  // strength requirement (see PasswordStrength below) — a weak
  // password cannot be submitted, and the checklist explains why.
  const strong = isStrongPassword(password);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
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
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { full_name: name.trim() || undefined },
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "That email already has an account — sign in instead."
          : signUpError.message
      );
      return;
    }
    // Email confirmation switched off: Supabase returns a session
    // straight away, so the customer is already signed in.
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }
    setSent(true);
  }

  return (
    <main id="main-content" style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h1>Create a customer account — Lumen Hair Studio</h1>
      <p>
        <Link href="/">← Back to the site</Link>
      </p>
      {!authConfigured && (
        <p role="alert" className="alert-note">
          <strong>Auth is not configured.</strong> Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local and restart the dev server. Sign-up is unavailable
          until then. See AUTH.md.
        </p>
      )}
      {sent ? (
        <>
          <p role="status" className="alert-note">
            <strong>Check your email.</strong> We sent a confirmation
            link to {email}. Click it, then sign in — your bookings and
            orders will be waiting on My account.
          </p>
          <p>
            <Link href="/my-account/sign-in">Go to customer sign in</Link>
          </p>
        </>
      ) : (
        <form className="lead-form" onSubmit={signUp}>
          <label>
            Your name (optional)
            <input
              type="text"
              autoComplete="name"
              placeholder="Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
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
            Confirm password
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || !strong}>
            {busy ? "Creating your account…" : "Create account"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <p>
        Already have an account?{" "}
        <Link href="/my-account/sign-in">Sign in</Link>
      </p>
      <p>
        <small>
          A customer account lets you see your own bookings and orders.
          Staff accounts are created by admin invitation only — this
          page is for customers.
        </small>
      </p>
    </main>
  );
}

export default function CustomerSignUpPage() {
  return (
    <Suspense>
      <CustomerSignUpForm />
    </Suspense>
  );
}

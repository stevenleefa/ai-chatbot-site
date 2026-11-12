"use client";

import { useRef } from "react";

// Sign-out button with a confirmation step, used in the fixed top
// nav (via OwnerNav, a server component). Clicking "Sign out"
// opens a native <dialog> ("Sign out?" with Cancel / Sign out);
// only the confirmed Sign out submits the POST to /auth/signout,
// so a stray click can never sign the owner out by accident. No
// window.confirm: the dialog is keyboard-reachable, Escape
// cancels, Cancel is focused when it opens (the safe choice),
// focus returns to the trigger button when it closes, and
// clicking the backdrop also cancels. Uses only useRef —
// React 18.3.1 (no React 19 hooks).
//
// The salon has no public signup page (invite-only; /signup was
// deleted), so there is no "sign up" page to confirm on — this
// nav button is the only sign-out control.
export default function SignOutButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={open}
        aria-haspopup="dialog"
      >
        Sign out
      </button>
      <dialog
        ref={dialogRef}
        className="signout-dialog"
        aria-labelledby="signout-title"
        onClick={(e) => {
          // Clicking the backdrop (the dialog itself, outside its
          // content) cancels, like Escape does.
          if (e.target === dialogRef.current) close();
        }}
        onClose={() => {
          // Native <dialog> usually returns focus itself, but
          // make it certain: focus is back on Sign out.
          triggerRef.current?.focus();
        }}
      >
        <h2 id="signout-title">Sign out?</h2>
        <p>You will need to sign in again to use the owner area.</p>
        <div className="signout-actions">
          <button
            type="button"
            className="signout-cancel"
            onClick={close}
            autoFocus
          >
            Cancel
          </button>
          <form action="/auth/signout" method="post">
            <button type="submit" className="signout-confirm">
              Sign out
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

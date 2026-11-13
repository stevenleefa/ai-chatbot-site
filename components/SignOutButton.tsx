"use client";

import { useId, useRef } from "react";

// Sign-out button with a confirmation step. Clicking the trigger
// opens a native <dialog> ("Sign out?" with Cancel / Sign out);
// only the confirmed action submits the POST to /auth/signout,
// so a stray click can never sign the owner out by accident. No
// window.confirm: the dialog is keyboard-reachable, Escape
// cancels, Cancel is focused when it opens (the safe choice),
// focus returns to the trigger button when it closes, and
// clicking the backdrop also cancels. Uses only useId/useRef —
// React 18.3.1 (no React 19 hooks).
//
// The salon has no public signup page (invite-only; /signup was
// deleted), so there is no "sign up" page to confirm on — this
// button is the sign-out control, used in the hamburger menu
// (components/HamburgerMenu.tsx) and on /profile. The label, the
// dialog copy and where the sign-out lands are props: "Log out"
// goes to "/" (the signout route's default), while "Switch user"
// posts to /auth/signout?next=/login so a different staff member
// can sign in. The dialog title id comes from useId() because the
// menu renders this button twice on one page (Log out + Switch
// user) and duplicate ids would be invalid.
export default function SignOutButton({
  label = "Sign out",
  next,
  dialogTitle = "Sign out?",
  dialogBody = "You will need to sign in again to use the owner area.",
  confirmLabel = "Sign out",
  className,
}: {
  label?: string;
  next?: string;
  dialogTitle?: string;
  dialogBody?: string;
  confirmLabel?: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

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
        className={className}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        className="signout-dialog"
        aria-labelledby={titleId}
        onClick={(e) => {
          // Clicking the backdrop (the dialog itself, outside its
          // content) cancels, like Escape does.
          if (e.target === dialogRef.current) close();
        }}
        onClose={() => {
          // Native <dialog> usually returns focus itself, but
          // make it certain: focus is back on the trigger.
          triggerRef.current?.focus();
        }}
      >
        <h2 id={titleId}>{dialogTitle}</h2>
        <p>{dialogBody}</p>
        <div className="signout-actions">
          <button
            type="button"
            className="signout-cancel"
            onClick={close}
            autoFocus
          >
            Cancel
          </button>
          <form
            action={
              next
                ? `/auth/signout?next=${encodeURIComponent(next)}`
                : "/auth/signout"
            }
            method="post"
          >
            <button type="submit" className="signout-confirm">
              {confirmLabel}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

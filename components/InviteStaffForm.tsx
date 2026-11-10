"use client";

import { useState, type FormEvent } from "react";
import { inviteUser } from "@/app/admin/actions";

// "Invite staff" form on /admin. Calls the inviteUser server action and
// shows its result inline (success or error) — the action returns a
// result object instead of throwing, so the page does not navigate away.
//
// React 18 note: useActionState is a React 19 hook and does not exist in
// this project's React 18.3.1 — and the React 18 action-state hooks
// (useFormState / useFormStatus) are not in the installed react-dom 18.3.1
// either (verified: no such exports). So the form calls the server action
// directly from an onSubmit handler and tracks the result and the sending
// state with useState instead. Same behaviour: the button disables while
// sending, and the result shows inline. The email field is controlled so
// it can be cleared after a successful invite (a failed invite keeps
// what was typed, so it can be fixed and retried); while sending, a
// small spinner shows next to the button text.
export default function InviteStaffForm() {
  const [state, setState] = useState({ ok: false, message: "" });
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const result = await inviteUser(
        { ok: false, message: "" },
        new FormData(event.currentTarget),
      );
      setState(result);
      if (result.ok) setEmail("");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <label>
        Staff email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="colleague@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button type="submit" disabled={sending}>
        {sending ? (
          <>
            <span className="spinner" aria-hidden="true" /> Sending invite…
          </>
        ) : (
          "Send invite"
        )}
      </button>
      {state.message && (
        <p role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
    </form>
  );
}

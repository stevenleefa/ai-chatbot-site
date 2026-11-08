"use client";

import { useActionState } from "react";
import { inviteUser } from "@/app/admin/actions";

// "Invite staff" form on /admin. Calls the inviteUser server action and
// shows its result inline (success or error) — the action returns a
// result object instead of throwing, so the page does not navigate away.
export default function InviteStaffForm() {
  const [state, action, pending] = useActionState(inviteUser, {
    ok: false,
    message: "",
  });

  return (
    <form className="lead-form" action={action}>
      <label>
        Staff email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="colleague@example.com"
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Sending invite…" : "Send invite"}
      </button>
      {state.message && (
        <p role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
    </form>
  );
}

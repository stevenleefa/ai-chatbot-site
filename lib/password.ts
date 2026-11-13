// Password strength rules for the two places a NEW password is set:
// customer sign-up (app/my-account/sign-up) and set-new-password
// (app/auth/update-password). Client-side UX aid only — Supabase
// remains the server-side enforcement, so these rules can never
// weaken anything: a password that fails here simply cannot be
// submitted from the form, and Supabase still applies its own
// minimums on top of whatever the form allows through.

export type PasswordRequirementId =
  | "length"
  | "uppercase"
  | "number"
  | "special";

export interface PasswordRequirement {
  id: PasswordRequirementId;
  label: string;
  met: boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

// A "special character" is any character that is not a letter or a
// digit, so ?, -, _, . and the rest all count — the label lists the
// common ones as examples, not as the whole set.
const SPECIAL_CHARACTER = /[^A-Za-z0-9]/;

export function checkPassword(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "uppercase",
      label: "One capital letter (A–Z)",
      met: /[A-Z]/.test(password),
    },
    {
      id: "number",
      label: "One number (0–9)",
      met: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "One special character (e.g. !@#$%^&*)",
      met: SPECIAL_CHARACTER.test(password),
    },
  ];
}

// Every requirement met — the only state in which the sign-up and
// set-new-password forms enable their submit button.
export function isStrongPassword(password: string): boolean {
  return checkPassword(password).every((requirement) => requirement.met);
}

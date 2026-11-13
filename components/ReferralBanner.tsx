"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Referral banner: a friend who opens a referral link
// (/?ref=<code>) sees a short note and the code is stored in the
// `lumen-ref` cookie (7 days, path /) so the booking form can
// attribute their booking to the referrer. Renders nothing when
// there is no ?ref= code. Dismissible — the ✕ hides it for this
// page load (the cookie is already stored, so dismissing never
// loses the attribution). Uses the existing .demo-banner style —
// no new colours, no new CSS.
export const REFERRAL_COOKIE = "lumen-ref";

export default function ReferralBanner() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    const clean = ref.trim();
    // Referral codes are short alphanumeric strings; anything else
    // is not a code we issued, so ignore it rather than storing it.
    if (!/^[a-z0-9-]{1,64}$/i.test(clean)) return;
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(clean)}; max-age=604800; path=/`;
    setCode(clean);
    // Run once on mount: the param is the entry point, not state
    // that should re-show the banner on later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!code || dismissed) return null;

  return (
    <div role="note" className="demo-banner">
      Referred by a friend — book and they&apos;ll get 50% off their
      next haircut.{" "}
      <button
        type="button"
        aria-label="Dismiss referral message"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}

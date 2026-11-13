"use client";

import { useState } from "react";
import Link from "next/link";

// "Refer a friend" — the customer's referral code + shareable link
// (from lib/referrals.ts, passed in by the /my-account server
// page). When a friend books through the link, the referrer earns
// 50% off their next haircut: hasCredit means a friend's booking
// completed and the credit is waiting; usedCount counts credits
// already spent, so a customer who used theirs sees that plainly
// instead of an empty "no credit" state.
export default function ReferralCard({
  code,
  link,
  hasCredit,
  usedCount,
}: {
  code: string;
  link: string;
  hasCredit: boolean;
  usedCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyLink() {
    setCopyFailed(false);
    let done = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        done = true;
      }
    } catch {
      // Fall through to the plain fallback below.
    }
    if (!done) {
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        if (typeof document.execCommand === "function") {
          done = document.execCommand("copy");
        }
        document.body.removeChild(ta);
      } catch {
        done = false;
      }
    }
    if (done) {
      setCopied(true);
    } else {
      setCopyFailed(true);
    }
  }

  return (
    <section aria-labelledby="refer-heading">
      <h2 id="refer-heading">Refer a friend</h2>
      <p>
        Share your link with a friend. When they book through it, you
        earn <strong>50% off your next haircut</strong>.
      </p>
      <p>
        <strong>Your referral code:</strong> {code}
      </p>
      <p>
        <label>
          Your referral link
          <input type="text" value={link} readOnly onFocus={(e) => e.target.select()} />
        </label>{" "}
        <button type="button" onClick={copyLink}>
          Copy link
        </button>
      </p>
      {copied && <p role="status">Copied — share it with a friend.</p>}
      {copyFailed && (
        <p role="alert">
          Copy did not work in this browser — select the link above and
          copy it manually.
        </p>
      )}
      {hasCredit && (
        <p role="status">
          <strong>You have 50% off your next haircut.</strong>{" "}
          <Link href="/#booking">Book your discounted haircut</Link>
        </p>
      )}
      {!hasCredit && usedCount > 0 && (
        <p>
          You already used your 50% off haircut credit
          {usedCount > 1 ? ` (${usedCount} used)` : ""} — refer another
          friend to earn a new one.
        </p>
      )}
      {!hasCredit && usedCount === 0 && (
        <p>
          <small>
            No referral credit yet — it appears here once a friend
            books through your link.
          </small>
        </p>
      )}
    </section>
  );
}

"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/business";

// Public review form (homepage Reviews section). Posts to
// /api/reviews; the review is saved as "pending" and only appears
// on the site once an admin approves it on /admin — the form says
// so plainly. The star picker is a real radio group (fieldset +
// legend, one radio per star, labels styled as stars): Tab reaches
// the group, arrow keys move between stars, Space / Enter selects.
// Same pattern as the stylist filter checkboxes — real inputs,
// not aria-pressed buttons.
export default function ReviewForm() {
  const [name, setName] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [service, setService] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setResult("Sending…");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          rating,
          service: service || null,
          text,
        }),
      });
      const data = await res.json();
      setResult(data.message ?? data.error ?? "Something went wrong.");
      // Clear the fields only on a successful submit, so a failed
      // submit keeps what the visitor typed and they can retry.
      if (res.ok && data.ok) {
        setName("");
        setRating(null);
        setService("");
        setText("");
        // Re-run the homepage server component so a newly approved
        // review (or the count) shows without a manual refresh.
        router.refresh();
      }
    } catch {
      setResult("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lead-form review-form" onSubmit={submit}>
      <h2>Leave a review</h2>
      <p>
        Your review will appear once the studio approves it — usually
        within a day.
      </p>
      <label>
        Your name
        <input
          placeholder="Your name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <fieldset className="star-picker">
        <legend>Your rating</legend>
        {/* DOM order 5 → 1 with row-reverse CSS: visually 1 → 5 left
            to right, and input:checked ~ label fills the checked star
            and every star to its left. */}
        <div className="star-row">
          {[5, 4, 3, 2, 1].map((n) => (
            <Fragment key={n}>
              <input
                type="radio"
                id={`rating-${n}`}
                name="rating"
                value={n}
                required
                checked={rating === n}
                onChange={() => setRating(n)}
                className="visually-hidden"
              />
              <label htmlFor={`rating-${n}`} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                ★
              </label>
            </Fragment>
          ))}
        </div>
        <p className="star-value" aria-live="polite">
          {rating === null
            ? "Choose a rating"
            : `${rating} out of 5 stars`}
        </p>
      </fieldset>
      <label>
        Service (optional)
        <select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">— No particular service —</option>
          {services.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Your review
        <textarea
          placeholder="Tell us how your visit went…"
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Submit review"}
      </button>
      {result && <p role="status">{result}</p>}
    </form>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import ChatWidget from "@/components/ChatWidget";
import ReviewForm from "@/components/ReviewForm";
import ReviewPopups from "@/components/ReviewPopups";
import ReviewAvatar from "@/components/ReviewAvatar";
import Stars from "@/components/Stars";
import { business } from "@/lib/business";
import { averageRating, type PublicReview } from "@/lib/reviews";
import { fmtDate } from "@/lib/format";
import type { SiteSettings } from "@/lib/site-settings";

type Service = { name: string; price: string; time: string; note: string };

// The homepage's interactive part: hero, services, reviews, booking
// form and the AI assistant section. Site contact info comes from
// the settings prop (database row when configured, lib/business.ts
// fallback otherwise); services and prices still come from
// lib/business.ts; the reviews list comes from the server (approved
// visitor reviews + seed reviews — see lib/reviews-server.ts).
// The fixed top nav lives in app/layout.tsx now — this component no
// longer renders its own nav.
export default function HomeClient({
  settings,
  services,
  reviews,
  ownerAppointmentsCard,
}: {
  settings: SiteSettings;
  services: Service[];
  reviews: PublicReview[];
  ownerAppointmentsCard: ReactNode;
}) {
  const initialLead = { name: "", contact: "", service: "Haircut", message: "" };
  const [lead, setLead] = useState(initialLead);
  const [leadResult, setLeadResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { average, count } = averageRating(reviews);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    // Ignore a second click / Enter while a submit is already in flight.
    if (submitting) return;
    setSubmitting(true);
    setLeadResult("Sending…");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      const data = await res.json();
      setLeadResult(data.message ?? data.error ?? "Something went wrong.");
      // Clear the fields only on a successful submit, so a failed
      // submit keeps what the user typed and they can retry.
      if (res.ok && data.ok) setLead(initialLead);
    } catch {
      setLeadResult("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main id="main-content">
      <header className="hero">
        <img className="hero-img" src="/hero.jpg" alt="Inside a bright, elegant hair studio" />
        <div className="hero-content">
          <span className="hero-tag">Cuts · Colour · Styling</span>
          <h1>{settings.business_name}</h1>
          <p>{business.tagline}</p>
          <p>{settings.address} · {settings.hours}</p>
          <p>Call: {settings.phone}</p>
          <a className="hero-cta" href="#booking">Book an appointment <span aria-hidden="true">→</span></a>
        </div>
      </header>

      {ownerAppointmentsCard}

      <section id="services" className="reveal">
        <h2>Services</h2>
        <div className="grid">
          {services.map((s) => (
            <article key={s.name} className="card">
              <div className="card-icon" aria-hidden="true">✂️</div>
              <h3>{s.name}</h3>
              <p className="price">{s.price} · {s.time}</p>
              <p>{s.note}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Booking (left) and Leave a review (right) side by side;
          they stack vertically on narrow screens — see
          .booking-review-row in globals.css. */}
      <div className="booking-review-row">
        <section id="booking" className="reveal">
          <h2>Book an appointment</h2>
          <div className="booking-card">
            <form className="lead-form" onSubmit={submitLead}>
              <label>
                Your name
                <input placeholder="Your name" required value={lead.name}
                  onChange={(e) => setLead({ ...lead, name: e.target.value })} />
              </label>
              <label>
                Service
                <select value={lead.service}
                  onChange={(e) => setLead({ ...lead, service: e.target.value })}>
                  {services.map((s) => <option key={s.name}>{s.name}</option>)}
                </select>
              </label>
              <label>
                Anything we should know? (optional)
                <textarea placeholder="Anything we should know? (optional)" rows={3} value={lead.message}
                  onChange={(e) => setLead({ ...lead, message: e.target.value })} />
              </label>
              <label>
                Phone or email
                <input placeholder="Phone or email" required value={lead.contact}
                  onChange={(e) => setLead({ ...lead, contact: e.target.value })} />
              </label>
              <button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Request booking"}</button>
            </form>
            {leadResult && <p>{leadResult}</p>}
            <p className="form-note"><small>Cancellations need at least 24 hours notice.</small></p>
          </div>
        </section>
        <ReviewForm />
      </div>

      <section id="assistant" className="reveal">
        <h2>Try the AI assistant</h2>
        <div className="assistant-card">
          <p>Click “Ask Lumen” at the bottom right. It answers only from the studio’s own details — try asking about a price it does not list, and watch it refuse to guess.</p>
        </div>
      </section>

      <section id="reviews" className="reveal">
        <h2>What our customers say</h2>
        <p>
          {count === 0 ? (
            "No reviews yet — be the first to leave one above."
          ) : (
            <>
              <Stars rating={Math.round(average)} />{" "}
              <strong>
                {average} out of 5 stars
              </strong>{" "}
              · {count} {count === 1 ? "review" : "reviews"}
            </>
          )}
        </p>
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id} className="review-item">
              <div className="review-head">
                <ReviewAvatar name={r.name} />
                <div>
                  <strong>{r.name}</strong>
                  <br />
                  <Stars rating={r.rating} />
                  {r.service ? (
                    <span className="review-service"> · {r.service}</span>
                  ) : null}
                  <span className="review-date"> · {fmtDate(r.createdAt)}</span>
                </div>
              </div>
              <p>{r.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <ChatWidget />
      <ReviewPopups />
    </main>
  );
}

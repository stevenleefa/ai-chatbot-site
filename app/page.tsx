"use client";

import { useState } from "react";
import ChatWidget from "@/components/ChatWidget";
import { business, services } from "@/lib/business";

export default function Home() {
  const [lead, setLead] = useState({ name: "", contact: "", service: "Haircut", message: "" });
  const [leadResult, setLeadResult] = useState("");

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setLeadResult("Sending…");
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    const data = await res.json();
    setLeadResult(data.message ?? data.error ?? "Something went wrong.");
  }

  return (
    <main>
      <header className="hero">
        <h1>{business.name}</h1>
        <p>{business.tagline}</p>
        <p>{business.address} · {business.hours}</p>
        <p>Call: {business.phone}</p>
      </header>

      <section>
        <h2>Services</h2>
        <div className="grid">
          {services.map((s) => (
            <article key={s.name} className="card">
              <h3>{s.name}</h3>
              <p className="price">{s.price} · {s.time}</p>
              <p>{s.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Book an appointment</h2>
        <form className="lead-form" onSubmit={submitLead}>
          <input placeholder="Your name" required value={lead.name}
            onChange={(e) => setLead({ ...lead, name: e.target.value })} />
          <input placeholder="Phone or email" required value={lead.contact}
            onChange={(e) => setLead({ ...lead, contact: e.target.value })} />
          <select value={lead.service}
            onChange={(e) => setLead({ ...lead, service: e.target.value })}>
            {services.map((s) => <option key={s.name}>{s.name}</option>)}
          </select>
          <textarea placeholder="Anything we should know? (optional)" value={lead.message}
            onChange={(e) => setLead({ ...lead, message: e.target.value })} />
          <button type="submit">Request booking</button>
        </form>
        {leadResult && <p>{leadResult}</p>}
        <p><small>Cancellations need at least 24 hours notice.</small></p>
      </section>

      <section>
        <h2>Try the AI assistant</h2>
        <p>Click “Ask Lumen” at the bottom right. It answers only from the studio’s own details — try asking about a price it does not list, and watch it refuse to guess.</p>
      </section>

      <ChatWidget />
    </main>
  );
}

import { DEALS } from "@/lib/deals";

// Deals page: the current offers from lib/deals.ts, rendered as
// cards. The offers themselves are demo content — edit
// lib/deals.ts to change them.
export default function DealsPage() {
  return (
    <main id="main-content">
      <h1>Deals</h1>
      <p>Current offers at Lumen Hair Studio.</p>
      <p className="dash-note">
        Demo offers for the sample salon — a real client replaces
        these with their own current promotions.
      </p>
      <div className="grid">
        {DEALS.map((deal) => (
          <article key={deal.id} className="card">
            <h2>{deal.title}</h2>
            <p className="price">{deal.highlight}</p>
            <p>{deal.description}</p>
            <p className="dash-note">{deal.terms}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

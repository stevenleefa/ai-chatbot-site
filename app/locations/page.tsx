import { business } from "@/lib/business";

// Locations page: the studio's one location, from
// lib/business.ts, with a "Get directions" link to Google Maps.
export default function LocationsPage() {
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business.name}, ${business.address}`
  )}`;
  return (
    <main id="main-content">
      <h1>Locations</h1>
      <p>Lumen Hair Studio has one studio — come and say hello.</p>
      <div className="card">
        <h2>{business.name}</h2>
        <p>Address: {business.address}</p>
        <p>Hours: {business.hours}</p>
        <p>Phone: {business.phone}</p>
        <p>
          <a href={directionsUrl} target="_blank" rel="noreferrer">
            Get directions
          </a>
        </p>
      </div>
    </main>
  );
}

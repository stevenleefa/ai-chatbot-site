import { business } from "@/lib/business";

// Locations page: the studio's four locations, each with a "Get
// directions" link to Google Maps. The first is the flagship from
// lib/business.ts; the other three are fictional branches of the
// same demo salon, same hours (Monday to Saturday, 9am to 6pm,
// closed Sunday) and the same (555) 014 exchange as the main
// number. The chatbot's location answer (lib/business.ts) still
// names the flagship only.
const LOCATIONS = [
  {
    name: business.name,
    address: business.address,
    hours: business.hours,
    phone: business.phone,
  },
  {
    name: `${business.name} — Riverside`,
    address: "48 Riverside Walk",
    hours: business.hours,
    phone: "(555) 014-8891",
  },
  {
    name: `${business.name} — Old Town`,
    address: "7 Old Town Square",
    hours: business.hours,
    phone: "(555) 014-8892",
  },
  {
    name: `${business.name} — Northgate`,
    address: "21 Northgate Lane",
    hours: business.hours,
    phone: "(555) 014-8893",
  },
];

export default function LocationsPage() {
  return (
    <main id="main-content">
      <h1>Locations</h1>
      <p>Lumen Hair Studio has four studios — come and say hello.</p>
      <div className="grid">
        {LOCATIONS.map((location) => {
          const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${location.name}, ${location.address}`
          )}`;
          return (
            <div className="card" key={location.address}>
              <h2>{location.name}</h2>
              <p>Address: {location.address}</p>
              <p>Hours: {location.hours}</p>
              <p>Phone: {location.phone}</p>
              <p>
                <a href={directionsUrl} target="_blank" rel="noreferrer">
                  Get directions
                </a>
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}

import Link from "next/link";
import { business } from "@/lib/business";

// Contact page: info only — phone, email, address and hours from
// lib/business.ts, with a link to the booking form. No contact
// form: enquiries go through the booking form or by phone.
export default function ContactPage() {
  return (
    <main id="main-content">
      <h1>Contact us</h1>
      <p>
        Call, email or drop in — the studio is at {business.address}.
      </p>
      <div className="card">
        <h2>{business.name}</h2>
        <p>
          Phone:{" "}
          <a href={`tel:${business.phone.replace(/[^0-9]/g, "")}`}>
            {business.phone}
          </a>
        </p>
        <p>
          Email:{" "}
          <a href={`mailto:${business.email}`}>{business.email}</a>
        </p>
        <p>Address: {business.address}</p>
        <p>Hours: {business.hours}</p>
        <p>
          <Link href="/#booking" className="hero-cta">
            Book an appointment
          </Link>
        </p>
      </div>
    </main>
  );
}

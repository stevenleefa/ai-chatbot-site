import { Suspense } from "react";
import DealsClient from "@/components/DealsClient";

// Deals page: the current offers from lib/deals.ts, rendered as
// cards. The offers themselves are demo content — edit
// lib/deals.ts to change them. The cards (with their QR codes and
// the coupon dialog) are a client component because they read the
// ?coupon= param a scanned QR code lands on; useSearchParams needs
// the Suspense boundary below.
export default function DealsPage() {
  return (
    <main id="main-content">
      <h1>Deals</h1>
      <p>Current offers at Lumen Hair Studio.</p>
      <p className="dash-note">
        Demo offers for the sample salon — a real client replaces
        these with their own current promotions.
      </p>
      <Suspense>
        <DealsClient />
      </Suspense>
    </main>
  );
}

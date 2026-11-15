import { Suspense } from "react";
import HomeClient from "@/components/HomeClient";
import OwnerAppointmentsCard from "@/components/OwnerAppointmentsCard";
import ReferralBanner from "@/components/ReferralBanner";
import { services } from "@/lib/business";
import { getSiteSettings } from "@/lib/site-settings";
import { getPublicReviews } from "@/lib/reviews-server";
import { APPOINTMENT_SLOTS, getAppointments } from "@/lib/customers";
import { getBookingStylists } from "@/lib/tools";

// Server component: loads the site settings (database row when
// configured, lib/business.ts fallback otherwise), the public
// reviews (approved visitor reviews + seed reviews), and renders
// the interactive homepage. The appointments card is passed in as a
// prop (OwnerAppointmentsCard renders nothing when signed out, so
// visitors never see it; passing it as a prop is what puts it just
// under the hero instead of at the very bottom of the page). The
// fixed top nav (public links + owner buttons) now comes from
// app/layout.tsx, so the homepage no longer carries its own nav.
export default async function Home() {
  const settings = await getSiteSettings();
  const reviews = await getPublicReviews();
  // Visitor-safe booking diary for the homepage daily view: each
  // booked appointment projected to date/time/stylist only. The
  // customer id and name never leave the server, so the daily view
  // can show busy vs free (and which stylist is booked) without
  // ever exposing another customer's name.
  const bookedAppointments = getAppointments().map((a) => ({
    date: a.date,
    time: a.time,
    stylist: a.stylist,
  }));
  const bookableStylists = getBookingStylists();
  return (
    <>
      {/* The referral banner reads ?ref= (useSearchParams), so it
          needs the Suspense boundary — same pattern as /deals. */}
      <Suspense>
        <ReferralBanner />
      </Suspense>
      <HomeClient
        settings={settings}
        services={services}
        reviews={reviews}
        ownerAppointmentsCard={<OwnerAppointmentsCard />}
        bookedAppointments={bookedAppointments}
        bookableStylists={bookableStylists}
        appointmentSlots={APPOINTMENT_SLOTS}
      />
    </>
  );
}

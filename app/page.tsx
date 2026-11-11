import HomeClient from "@/components/HomeClient";
import OwnerAppointmentsCard from "@/components/OwnerAppointmentsCard";
import { services } from "@/lib/business";
import { getSiteSettings } from "@/lib/site-settings";
import { getPublicReviews } from "@/lib/reviews-server";

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
  return (
    <HomeClient
      settings={settings}
      services={services}
      reviews={reviews}
      ownerAppointmentsCard={<OwnerAppointmentsCard />}
    />
  );
}

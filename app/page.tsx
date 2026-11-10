import AuthNav from "@/components/AuthNav";
import HomeClient from "@/components/HomeClient";
import OwnerAppointmentsCard from "@/components/OwnerAppointmentsCard";
import { services } from "@/lib/business";
import { getSiteSettings } from "@/lib/site-settings";

// Server component: loads the site settings (database row when
// configured, lib/business.ts fallback otherwise) and renders the
// interactive homepage. The owner nav links come from the server
// component AuthNav, passed in as a prop — and the appointments card
// the same way (OwnerAppointmentsCard renders nothing when signed out,
// so visitors never see it; passing it as a prop is what puts it just
// under the hero instead of at the very bottom of the page).
export default async function Home() {
  const settings = await getSiteSettings();
  return (
    <HomeClient
      settings={settings}
      services={services}
      authNav={<AuthNav />}
      ownerAppointmentsCard={<OwnerAppointmentsCard />}
    />
  );
}

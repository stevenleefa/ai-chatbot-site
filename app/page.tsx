import AuthNav from "@/components/AuthNav";
import HomeClient from "@/components/HomeClient";
import { services } from "@/lib/business";
import { getSiteSettings } from "@/lib/site-settings";

// Server component: loads the site settings (database row when
// configured, lib/business.ts fallback otherwise) and renders the
// interactive homepage. The owner nav links come from the server
// component AuthNav, passed in as a prop.
export default async function Home() {
  const settings = await getSiteSettings();
  return <HomeClient settings={settings} services={services} authNav={<AuthNav />} />;
}

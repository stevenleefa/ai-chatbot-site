import Link from "next/link";
import OwnerNav from "./OwnerNav";
import ThemeToggle from "./ThemeToggle";
import { getSiteSettings } from "@/lib/site-settings";

// Fixed top navigation, rendered from app/layout.tsx so it is on
// every page (public and owner). Always visible at the very top while
// scrolling (position: fixed); the body padding-top in globals.css
// reserves its height so it never covers content. Anchor links use
// the /#section form so they work from any page, not just the
// homepage. The owner buttons come from OwnerNav (Dashboard, Leads,
// Customers, Appointments, Employees, Orders, Admin for admins,
// Sign out — or "Owner sign in" when signed out).
export default async function SiteNav() {
  const settings = await getSiteSettings();
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand">
          {settings.business_name}
        </Link>
        <nav aria-label="Main" className="site-nav-links">
          <Link href="/#services">Services</Link>
          <Link href="/products">Products</Link>
          <Link href="/#reviews">Reviews</Link>
          <Link href="/#booking">Booking</Link>
          <Link href="/#assistant">Assistant</Link>
        </nav>
        <OwnerNav />
        <ThemeToggle />
      </div>
    </header>
  );
}

import Link from "next/link";
import HamburgerMenu, { type MenuUser } from "./HamburgerMenu";
import SearchBox, { type SearchItem } from "./SearchBox";
import AssistantNavLink from "./AssistantNavLink";
import { getSession } from "@/lib/auth/session";
import { getDisplayName, getInitials } from "@/lib/user-display";
import { getSiteSettings } from "@/lib/site-settings";
import { services } from "@/lib/business";
import { PRODUCTS, formatPrice } from "@/lib/products";

// Fixed top navigation, rendered from app/layout.tsx so it is on
// every page (public and owner). Always visible at the very top while
// scrolling (position: fixed); the body padding-top in globals.css
// reserves its height so it never covers content. Anchor links use
// the /#section form so they work from any page, not just the
// homepage. "Assistant" is not an anchor: it is a button
// (components/AssistantNavLink.tsx) that opens the Lumen Assistant
// chat window instead of scrolling to the #assistant section, and
// clicking any other nav link closes the chat (see
// components/ChatWidget.tsx). The right side holds the search box and the hamburger
// menu (components/HamburgerMenu.tsx): the menu carries the account
// rows, the dark-mode toggle, the site links and the owner links
// that used to sit in the header as OwnerNav pills. There is no
// separate "Owner sign in" button any more — the menu's "Sign in"
// goes to /login, which already recognises the owner automatically.
export default async function SiteNav() {
  const settings = await getSiteSettings();
  const session = await getSession();
  let menuUser: MenuUser | null = null;
  if (session) {
    const name = getDisplayName(session.user);
    menuUser = {
      initials: getInitials(name),
      name,
      email: session.profile.email,
      role: session.profile.role,
    };
  }
  // Searchable items for the header search box: services go to the
  // services section, products go to the shop page.
  const searchItems: SearchItem[] = [
    ...services.map((s) => ({
      label: `${s.name} — ${s.price}`,
      href: "/#services",
    })),
    ...PRODUCTS.map((p) => ({
      label: `${p.name} — ${formatPrice(p.priceCents)}`,
      href: "/products",
    })),
  ];
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
          <AssistantNavLink />
        </nav>
        <div className="site-nav-tools">
          <SearchBox items={searchItems} />
          <HamburgerMenu user={menuUser} />
        </div>
      </div>
    </header>
  );
}

import "./globals.css";
import type { ReactNode } from "react";
import { Playfair_Display, Inter } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import ChatWidget from "@/components/ChatWidget";
import GuidedTour from "@/components/GuidedTour";
import NavHeight from "@/components/NavHeight";
import PersonalizationProvider, {
  PersonalizationScript,
} from "@/components/PersonalizationProvider";
import BackToTop from "@/components/BackToTop";
import { business } from "@/lib/business";
import { getDemoOrSession } from "@/lib/auth/demo";
import { getDisplayName } from "@/lib/user-display";

// Pre-paint theme script: reads the saved choice ("lumen-theme") or
// the system preference and sets data-theme on <html> BEFORE first
// paint, so the page never flashes the wrong theme. It must run
// synchronously in <head>; components/ThemeToggle.tsx only keeps the
// attribute in sync afterwards. suppressHydrationWarning on <html>
// is for this attribute, which the script sets before React hydrates.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("lumen-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: `${business.name} — Haircuts, Colour & Styling`,
  description: `${business.name}: ${business.tagline} Open ${business.hours}`,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The signed-in user's display name for the chat greeting, from
  // the server session — never from client input. SiteNav reads
  // the same session for the hamburger menu; this is a second read
  // of the same session, kept here so the name reaches the chat
  // widget (which is mounted in this layout, not in the nav).
  const { session } = await getDemoOrSession();
  const displayName = session ? getDisplayName(session.user) : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Browser chrome colour (theme-color): the hint Safari and
            Chrome use to tint the tab/address bar. The default here
            is the plum light header (#3d2433); the personalization
            pre-paint script and applyPreferences update it to the
            customer's theme + light/dark mode (see
            lib/personalization.ts themeColorFor). It is a hint —
            browsers may tint the chrome but desktop behaviour
            varies; it never recolours the whole browser window. */}
        <meta name="theme-color" content="#3d2433" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <PersonalizationScript />
      </head>
      <body className={`${display.variable} ${bodyFont.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SiteNav />
        <NavHeight />
        <PersonalizationProvider />
        {children}
        {/* The "Ask Lumen" chat widget lives here, not on the
            homepage, so the header's "Assistant" item can open it
            from any page (components/AssistantNavLink.tsx). It is
            position: fixed bottom-right, so moving it out of <main>
            changes nothing visually. */}
        <ChatWidget displayName={displayName} />
        {/* The guided tour (components/GuidedTour.tsx) renders
            nothing until the customer starts it from the hamburger
            menu — it never auto-starts. */}
        <GuidedTour />
        <BackToTop />
      </body>
    </html>
  );
}

import "./globals.css";
import type { ReactNode } from "react";
import { Playfair_Display, Inter } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import NavHeight from "@/components/NavHeight";
import BackToTop from "@/components/BackToTop";
import { business } from "@/lib/business";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${display.variable} ${bodyFont.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SiteNav />
        <NavHeight />
        {children}
        <BackToTop />
      </body>
    </html>
  );
}

import "./globals.css";
import type { ReactNode } from "react";
import { Playfair_Display, Inter } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import { business } from "@/lib/business";

const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: `${business.name} — Haircuts, Colour & Styling`,
  description: `${business.name}: ${business.tagline} Open ${business.hours}`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${bodyFont.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}

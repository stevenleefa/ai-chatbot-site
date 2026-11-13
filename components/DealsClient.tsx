"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "react-qr-code";
import { DEALS, couponUrl, findDealByCode, type Deal } from "@/lib/deals";
import CouponDialog from "@/components/CouponDialog";

// Deals page client part: the deal cards (from lib/deals.ts) plus
// the coupon dialog. Each card carries a QR code that encodes the
// deal's coupon URL (production /deals?coupon=<code> — see
// lib/deals.ts) and a "Show coupon" button; tapping either opens
// the same coupon dialog. A scanned QR lands here as
// /deals?coupon=<code>, which opens that deal's coupon straight
// away; an unknown code simply shows the deals with no dialog.
// Closing the dialog drops the ?coupon= param (so a refresh does
// not reopen it) and returns focus to the button that opened it.
export default function DealsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [couponDeal, setCouponDeal] = useState<Deal | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const code = searchParams.get("coupon");
    if (!code) return;
    const deal = findDealByCode(code);
    if (!deal) return;
    triggerRef.current = buttonRefs.current.get(deal.id) ?? null;
    setCouponDeal(deal);
    // Run once on mount: the param is the entry point, not state
    // that should reopen the dialog on later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCoupon(deal: Deal, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setCouponDeal(deal);
  }

  function closeCoupon() {
    setCouponDeal(null);
    router.replace("/deals", { scroll: false });
    triggerRef.current?.focus();
    triggerRef.current = null;
  }

  return (
    <>
      <div className="grid">
        {DEALS.map((deal) => (
          <article key={deal.id} className="card">
            <h2>{deal.title}</h2>
            <p className="price">{deal.highlight}</p>
            <p>{deal.description}</p>
            <p className="dash-note">{deal.terms}</p>
            <button
              type="button"
              className="deal-qr"
              aria-label={`Show coupon for ${deal.title}`}
              onClick={(e) => openCoupon(deal, e.currentTarget)}
            >
              <QRCode
                value={couponUrl(deal)}
                size={120}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </button>
            <button
              type="button"
              className="deal-coupon-btn"
              ref={(el) => {
                if (el) buttonRefs.current.set(deal.id, el);
              }}
              onClick={(e) => openCoupon(deal, e.currentTarget)}
            >
              Show coupon
            </button>
          </article>
        ))}
      </div>
      <CouponDialog deal={couponDeal} onClose={closeCoupon} />
    </>
  );
}

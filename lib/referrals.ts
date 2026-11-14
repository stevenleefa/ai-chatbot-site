// Referrals — server-only helpers (imports lib/supabase.ts, so
// never import this from a client component).
//
// How it works: a signed-in customer gets a short referral code
// (getOrCreateReferralCode) and a link like
// https://ai-chatbot-site-tawny.vercel.app/?ref=<code>. A friend
// who opens the link sees the ReferralBanner, which stores the code
// in the `lumen-ref` cookie; when the friend books (POST /api/lead
// with an email contact), recordReferralBooking marks the referral
// completed, which earns the referrer a 50%-off-a-haircut credit
// (getReferrerDiscount / redeemReferralCredit). Earning is tracked
// only when Supabase is configured — without it the link still
// displays, via a deterministic code derived from the email, but no
// referral row exists to complete.

import { getServerSupabase, isSupabaseConfigured } from "./supabase";

const CODE_LENGTH = 8;
const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const PRODUCTION_URL = "https://ai-chatbot-site-tawny.vercel.app";

// Deterministic 8-char lowercase base36 code for an email — used
// only when Supabase is unconfigured, so the referral link still
// displays. Stable for the same email (same input → same code).
// Not a secret and not unique across different emails by guarantee;
// it is a display fallback, never a lookup key for earning credit.
export function deterministicReferralCode(email: string): string {
  const normalized = email.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).padStart(CODE_LENGTH, "0").slice(-CODE_LENGTH);
}

function randomReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// The customer's referral code: their existing one (any status) or
// a newly created one. Retries on a unique-code collision.
export async function getOrCreateReferralCode(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  if (!isSupabaseConfigured()) return deterministicReferralCode(normalized);
  const supabase = getServerSupabase();
  try {
    const { data, error } = await supabase!
      .from("referrals")
      .select("code")
      .eq("referrer_email", normalized)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!error && data && data.length > 0) return data[0].code as string;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomReferralCode();
      const { error: insertError } = await supabase!
        .from("referrals")
        .insert({ code, referrer_email: normalized, status: "pending" });
      if (!insertError) return code;
      // A unique-code collision (23505) just means "try another code";
      // any other error is a real failure, so stop retrying.
      if ((insertError as { code?: string }).code !== "23505") {
        console.error("Failed to create referral code:", insertError.message);
        break;
      }
    }
  } catch (err) {
    console.error("Failed to get referral code:", err);
  }
  // Last resort: the display fallback, so the page still shows a link.
  return deterministicReferralCode(normalized);
}

// Look a code up: who referred the visitor. Case-insensitive, and
// trims stray whitespace from a typed or pasted code.
export async function getReferralByCode(
  code: string
): Promise<{ referrer_email: string } | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized || !isSupabaseConfigured()) return null;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("referrals")
      .select("referrer_email")
      .ilike("code", normalized)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return { referrer_email: data[0].referrer_email as string };
  } catch (err) {
    console.error("Failed to look up referral code:", err);
    return null;
  }
}

// Mark a referral completed when the referred friend books. Only a
// pending referral with no referred_email yet (or one already
// recorded for this same friend) completes — a code is earned once.
// Never throws: a referral failure must never break a booking.
export async function recordReferralBooking(
  code: string,
  referredEmail: string
): Promise<void> {
  const normalizedCode = code.trim().toLowerCase();
  const normalizedEmail = normalizeEmail(referredEmail);
  if (!normalizedCode || !normalizedEmail || !isSupabaseConfigured()) return;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("referrals")
      .select("id,referred_email")
      .ilike("code", normalizedCode)
      .eq("status", "pending")
      .limit(1);
    if (error || !data || data.length === 0) return;
    const row = data[0] as { id: string; referred_email: string | null };
    if (row.referred_email && row.referred_email !== normalizedEmail) return;
    // Do not let the referrer earn credit for referring themselves.
    const { data: referrerRow } = await supabase!
      .from("referrals")
      .select("referrer_email")
      .eq("id", row.id)
      .limit(1);
    if (
      referrerRow &&
      referrerRow.length > 0 &&
      (referrerRow[0].referrer_email as string) === normalizedEmail
    ) {
      return;
    }
    const { error: updateError } = await supabase!
      .from("referrals")
      .update({
        referred_email: normalizedEmail,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending");
    if (updateError) {
      console.error("Failed to complete referral:", updateError.message);
    }
  } catch (err) {
    console.error("Failed to record referral booking:", err);
  }
}

// Does this customer hold an unused 50%-off-a-haircut credit —
// i.e. at least one referral with status 'completed'?
export async function getReferrerDiscount(
  email: string
): Promise<{ hasCredit: boolean }> {
  const normalized = normalizeEmail(email);
  if (!isSupabaseConfigured()) return { hasCredit: false };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("referrals")
      .select("id")
      .eq("referrer_email", normalized)
      .eq("status", "completed")
      .limit(1);
    if (error || !data) return { hasCredit: false };
    return { hasCredit: data.length > 0 };
  } catch (err) {
    console.error("Failed to check referral credit:", err);
    return { hasCredit: false };
  }
}

// Spend the referrer's oldest completed referral credit (called
// when the referrer books a Haircut with the discount). True when
// one was redeemed, false when the customer held no credit.
export async function redeemReferralCredit(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("referrals")
      .select("id")
      .eq("referrer_email", normalized)
      .eq("status", "completed")
      .order("completed_at", { ascending: true })
      .limit(1);
    if (error || !data || data.length === 0) return false;
    const { error: updateError } = await supabase!
      .from("referrals")
      .update({ status: "redeemed" })
      .eq("id", (data[0] as { id: string }).id)
      .eq("status", "completed");
    if (updateError) {
      console.error("Failed to redeem referral credit:", updateError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to redeem referral credit:", err);
    return false;
  }
}

// The shareable referral link: the production homepage with
// ?ref=<code>. NEXT_PUBLIC_SITE_URL wins when set (production env);
// otherwise the live demo URL — a phone that opens the link cannot
// reach localhost, so the link always points at production.
export function buildReferralLink(code: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_URL).replace(
    /\/$/,
    ""
  );
  return `${base}/?ref=${code}`;
}

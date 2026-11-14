import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  validatePreferencesStrict,
} from "@/lib/personalization";
import { clientIp, rateLimit, readCappedJson } from "@/lib/security";

// Per-customer display preferences (see PERSONALIZATION.md).
// GET returns the signed-in user's saved preferences (defaults when
// there is no row). When Supabase is unconfigured it answers
// { configured: false, preferences: <defaults> } so the client knows
// to use the localStorage copy only. POST saves them, keyed by the
// verified session user id — the client is never trusted for the id.
// Unknown field values are rejected with 400 (strict validation).

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      preferences: DEFAULT_PREFERENCES,
    });
  }
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({
      configured: false,
      preferences: DEFAULT_PREFERENCES,
    });
  }
  const { data, error } = await supabase
    .from("customer_preferences")
    .select(
      "theme, font_pairing, font_size, high_contrast, reduce_motion, larger_text, voice_uri, voice_rate, voice_pitch",
    )
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({
      configured: true,
      preferences: DEFAULT_PREFERENCES,
    });
  }
  return NextResponse.json({
    configured: true,
    preferences: parsePreferences({
      theme: data.theme,
      fontPairing: data.font_pairing,
      fontSize: data.font_size,
      highContrast: data.high_contrast,
      reduceMotion: data.reduce_motion,
      largerText: data.larger_text,
      voiceURI: data.voice_uri,
      voiceRate: data.voice_rate,
      voicePitch: data.voice_pitch,
    }),
  });
}

export async function POST(req: Request) {
  const { body, tooLarge } = await readCappedJson(req);
  if (tooLarge) {
    return NextResponse.json(
      { error: "That request is too large." },
      { status: 413 },
    );
  }
  const ip = clientIp(req);
  const limit = rateLimit(`preferences:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error: "Preferences are not set up yet — they were not saved to your account.",
      },
      { status: 503 },
    );
  }
  const validation = validatePreferencesStrict(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.errors.join(" ") },
      { status: 400 },
    );
  }
  const prefs = validation.preferences;
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        configured: false,
        error: "Preferences are not set up yet — they were not saved to your account.",
      },
      { status: 503 },
    );
  }
  const { error } = await supabase.from("customer_preferences").upsert(
    {
      user_id: session.user.id,
      theme: prefs.theme,
      font_pairing: prefs.fontPairing,
      font_size: prefs.fontSize,
      high_contrast: prefs.highContrast,
      reduce_motion: prefs.reduceMotion,
      larger_text: prefs.largerText,
      voice_uri: prefs.voiceURI,
      voice_rate: prefs.voiceRate,
      voice_pitch: prefs.voicePitch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    return NextResponse.json(
      { error: "Could not save these settings." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, preferences: prefs });
}

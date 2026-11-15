// Per-customer personalisation (lib/personalization.ts) — client-safe,
// pure, no Supabase. The customer picks a colour theme, a font pairing,
// a font size and three accessibility options; the choice is applied to
// <html> as data attributes (see applyPreferences) and the CSS in
// app/globals.css does the actual restyling. Persistence is localStorage
// (key "lumen-preferences") for every visitor, plus the
// customer_preferences table via /api/preferences when signed in —
// see PERSONALIZATION.md.
//
// This is NOT a revival of the old header-colour switcher (removed
// 2026-11-12, colours hardcoded to plum light / rose dark). Plum/rose
// is still the default here: a customer who never picks anything sees
// exactly the site they saw before this change.

export type ThemeId = "plum" | "rose" | "teal" | "forest" | "navy" | "purple" | "orange-blue" | "yellow";
export type FontPairingId = "classic" | "clean" | "readable";
export type FontSizeId = "small" | "medium" | "large";

export interface PersonalizationPreferences {
  theme: ThemeId;
  fontPairing: FontPairingId;
  fontSize: FontSizeId;
  highContrast: boolean;
  reduceMotion: boolean;
  largerText: boolean;
  /** Voice the assistant speaks with (speechSynthesis voiceURI, or a
   * voice name when the voice has no voiceURI). "" (empty string) =
   * the browser default voice — that is what "Default voice" in the
   * picker stores. null is the legacy never-set value (rows saved
   * before the Samantha default, and old localStorage):
   * parsePreferences resolves it to the default voice, Samantha,
   * so a parsed preference never holds null. The type still allows
   * null because unparsed stored input can hold it. */
  voiceURI: string | null;
  /** Spoken-reply speed (0.75 slow, 1 normal, 1.25 fast). */
  voiceRate: number;
  /** Spoken-reply pitch (0.75 low, 1 normal, 1.25 high). */
  voicePitch: number;
  /** The stylist the customer prefers (one of STYLIST_NAMES).
   * Null = no preference. Saved, not yet used by booking — the
   * booking form will offer them first in a later step. */
  preferredStylist: string | null;
  /** Email notifications: appointment reminders and offers. This
   * is a preference only — the site does not yet send reminder or
   * marketing emails (only Supabase Auth invites/resets go out,
   * via Yahoo SMTP). Default true. */
  emailNotifications: boolean;
}

export const DEFAULT_PREFERENCES: PersonalizationPreferences = {
  theme: "plum",
  fontPairing: "classic",
  fontSize: "medium",
  highContrast: false,
  reduceMotion: false,
  largerText: false,
  // The default voice is Samantha, a macOS system voice, stored by
  // name so findVoiceByUri (lib/speech.ts) resolves it on a Mac.
  // Where no voice by that name exists it falls back gracefully
  // to the first English voice / browser default, exactly as a
  // saved voice from another device does. "" (empty string) is
  // what "Default voice" in the picker stores — the explicit
  // browser default. null is only ever a legacy value (rows saved
  // before this default); parsePreferences resolves it to
  // Samantha, so it never reaches the picker or the chat again.
  voiceURI: "Samantha",
  voiceRate: 1,
  voicePitch: 1.25,
  preferredStylist: null,
  emailNotifications: true,
};

export const STORAGE_KEY = "lumen-preferences";

export const THEME_IDS: ThemeId[] = ["plum", "rose", "teal", "forest", "navy", "purple", "orange-blue", "yellow"];
export const FONT_PAIRING_IDS: FontPairingId[] = ["classic", "clean", "readable"];
export const FONT_SIZE_IDS: FontSizeId[] = ["small", "medium", "large"];

// --- Contrast (WCAG 2.1 AA, relative luminance) -------------------------
// The ratios below were computed with this same function (see
// __tests__/personalization.test.ts, which re-computes them from the
// hex values and asserts every key pair is >= 4.5:1). Bar: normal
// text 4.5:1; the header pair and the white-on-accent button pair are
// normal text, so they use the same bar.

export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  /** Button gradient start / accent colour. */
  accent: string;
  /** Button gradient end / deeper accent. */
  deep: string;
  /** Button hover end (darker than deep). */
  hover: string;
  /** Accent text on the light page background (#fdf8f1). */
  textLight: string;
  /** Accent text on the dark page background (#221820). */
  textDark: string;
  /** Header background in light mode; header text is navFgLight
   * (cream #fdf8f1 for every theme except Yellow, whose bright
   * header needs dark text). */
  navBgLight: string;
  /** Header text in light mode. Cream #fdf8f1 for every theme
   * except Yellow (#1a0f16 — cream on its bright yellow header
   * is 1.81:1, far below AA). */
  navFgLight: string;
  /** Header background in dark mode; header text is white. */
  navBgDark: string;
  /** Chart series colour on the dark panel (light variant). */
  chartDark: string;
  /** Computed WCAG ratios (rounded to 2dp in the comments). */
  contrast: {
    whiteOnAccent: number;
    whiteOnDeep: number;
    whiteOnHover: number;
    headerLight: number;
    headerDark: number;
    textOnPageLight: number;
    textOnPageDark: number;
  };
}

function theme(
  id: ThemeId,
  label: string,
  description: string,
  accent: string,
  deep: string,
  hover: string,
  textLight: string,
  textDark: string,
  navBgLight: string,
  navBgDark: string,
  chartDark: string,
  // Light-mode header text. Cream for every theme except Yellow,
  // whose bright yellow header needs dark text (see navFgLight).
  navFgLight: string = "#fdf8f1",
): ThemeDefinition {
  return {
    id,
    label,
    description,
    accent,
    deep,
    hover,
    textLight,
    textDark,
    navBgLight,
    navFgLight,
    navBgDark,
    chartDark,
    contrast: {
      whiteOnAccent: contrastRatio("#ffffff", accent),
      whiteOnDeep: contrastRatio("#ffffff", deep),
      whiteOnHover: contrastRatio("#ffffff", hover),
      headerLight: contrastRatio(navFgLight, navBgLight),
      headerDark: contrastRatio("#ffffff", navBgDark),
      textOnPageLight: contrastRatio(textLight, "#fdf8f1"),
      textOnPageDark: contrastRatio(textDark, "#221820"),
    },
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  // Plum is the site's existing theme, unchanged: rose #a05a66 /
  // #8e4a56, plum header #3d2433 in light mode, rose header in dark.
  plum: theme(
    "plum",
    "Plum",
    "The studio's own plum and rose — the default.",
    "#a05a66", "#8e4a56", "#7a3f4a",
    "#8e4a56", "#e8a7ad",
    "#3d2433", "#a05a66", "#e08a94",
  ),
  // Rose: a deeper, redder rose than plum's accent.
  rose: theme(
    "rose",
    "Rose",
    "A deeper rose red, light and dark.",
    "#9c3d54", "#7f2d40", "#6b2436",
    "#7f2d40", "#f9a8d4",
    "#4a1524", "#9c3d54", "#f9a8d4",
  ),
  // Teal: the dark teal already used for stylist Maya (#0f766e, 5.47:1).
  teal: theme(
    "teal",
    "Teal",
    "A deep teal green-blue.",
    "#0f766e", "#0b5a53", "#084c46",
    "#0b5a53", "#7dd3c8",
    "#0b3d3a", "#0f766e", "#7dd3c8",
  ),
  // Forest: the dark green already used for stylist Jordan (#166534).
  forest: theme(
    "forest",
    "Forest",
    "A deep leaf green.",
    "#166534", "#14532d", "#0f3d21",
    "#14532d", "#86efac",
    "#0f2e1d", "#166534", "#86efac",
  ),
  // Navy: the dark navy already used for appointments (#1e3a5f).
  navy: theme(
    "navy",
    "Navy",
    "A deep classic navy blue.",
    "#1e3a5f", "#172c49", "#12263f",
    "#172c49", "#93c5fd",
    "#101f33", "#1e3a5f", "#93c5fd",
  ),
  // Purple: a true violet, clearly distinct from Plum and Rose
  // (the two the customer said look alike). Accent #7c3aed is the
  // tag-services colour already used on the owner pages.
  purple: theme(
    "purple",
    "Purple",
    "A true violet — clearly distinct from plum and rose.",
    "#7c3aed", "#5b21b6", "#4c1d95",
    "#5b21b6", "#c4b5fd",
    "#3b0764", "#7c3aed", "#c4b5fd",
  ),
  // Orange/Blue: navy header + burnt-orange accent, like the
  // plumbing demo (navy #0f2a44, orange #ff6b1a). Bright orange
  // fails white-on-4.5:1, so the accent is the darker burnt
  // orange #c2410c; the dark-mode header is the orange, the
  // light-mode header the navy.
  "orange-blue": theme(
    "orange-blue",
    "Orange/Blue",
    "Navy blue header with a burnt-orange accent.",
    "#c2410c", "#9a3412", "#7c2d12",
    "#9a3412", "#fdba74",
    "#0f2a44", "#c2410c", "#fdba74",
  ),
  // Yellow: a warm yellow, clearly distinct from the other seven.
  // White on bright yellow fails, so the accent is the dark gold
  // #a16207 — but the light-mode header IS bright yellow
  // (#eab308) with dark text (#1a0f16, 9.74:1), so the change is
  // visible at once. That is the one theme whose light header
  // text is not cream: navFgLight is passed as the last argument
  // and the headerLight ratio is computed against it. The CSS
  // block (app/globals.css) overrides --nav-fg the same way, and
  // sets --plum-deep to a dark gold — --plum-deep carries white
  // text (chat head, table headers, back-to-top), which fails on
  // bright yellow.
  yellow: theme(
    "yellow",
    "Yellow",
    "A warm sunny yellow — bright header, dark text.",
    "#a16207", "#854d0e", "#713f12",
    "#854d0e", "#fde047",
    "#eab308", "#a16207", "#fde047",
    "#1a0f16",
  ),
};

// --- Font pairings --------------------------------------------------------
// Only fonts the site already loads (Playfair Display + Inter, via
// next/font in app/layout.tsx) plus system fonts — no new font load.
// "classic" is the site as it is today (no CSS override at all).
export interface FontPairing {
  id: FontPairingId;
  label: string;
  description: string;
}

export const FONT_PAIRINGS: Record<FontPairingId, FontPairing> = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Playfair Display headings, Inter body — the studio's own look.",
  },
  clean: {
    id: "clean",
    label: "Clean",
    description: "Inter for headings and body — one plain sans throughout.",
  },
  readable: {
    id: "readable",
    label: "Readable",
    description: "Georgia serif headings, system sans body — high legibility.",
  },
};

// --- Font sizes -----------------------------------------------------------
// Medium is the site as it is today (no override). Small is ~0.9x and
// large ~1.15x on the text that scales (see PERSONALIZATION.md for
// what scales and what does not — the site uses px in many places, so
// this is targeted rules in globals.css, not a single root size).
export interface FontSizeOption {
  id: FontSizeId;
  label: string;
  /** Body font-size the size applies (medium = the browser default). */
  bodyPx: number;
  /** Section h2 size (medium = the site's 34px). */
  headingPx: number;
  /** Button font-size (medium = the site's 14px). */
  buttonPx: number;
}

export const FONT_SIZES: Record<FontSizeId, FontSizeOption> = {
  small: { id: "small", label: "Small", bodyPx: 15, headingPx: 30, buttonPx: 13 },
  medium: { id: "medium", label: "Medium", bodyPx: 16, headingPx: 34, buttonPx: 14 },
  large: { id: "large", label: "Large", bodyPx: 18, headingPx: 39, buttonPx: 16 },
};

// --- Voice options --------------------------------------------------------
// The assistant's spoken voice: which voice, how fast, how high.
// The voice list itself comes from the browser (speechSynthesis
// .getVoices()) — it differs by browser and OS (Safari on Mac has
// its own set, Chrome has Google voices), so the picker lists
// whatever this browser offers. Rate and pitch are the same three
// steps for every voice. The valid range for both is 0.5–2; the
// panel only offers the three steps below, but the API accepts any
// number in range (see isVoiceRate / isVoicePitch).
export interface VoiceOption {
  /** SpeechSynthesisUtterance rate/pitch value. */
  value: number;
  label: string;
}

export const VOICE_RATE_OPTIONS: VoiceOption[] = [
  { value: 0.75, label: "Slow" },
  { value: 1, label: "Normal" },
  { value: 1.25, label: "Fast" },
];

export const VOICE_PITCH_OPTIONS: VoiceOption[] = [
  { value: 0.75, label: "Low" },
  { value: 1, label: "Normal" },
  { value: 1.25, label: "High" },
];

/** The valid range for voice rate and pitch. */
export const VOICE_RATE_MIN = 0.5;
export const VOICE_RATE_MAX = 2;
export const VOICE_PITCH_MIN = 0.5;
export const VOICE_PITCH_MAX = 2;

// --- Preferred stylist ----------------------------------------------------
// The five stylists, by full name. The source of truth is EMPLOYEES in
// lib/dashboard.ts — these names are duplicated here deliberately so
// this client-safe file does not import the dashboard module (which
// carries the 1,377-row SALES array into the client bundle).
// __tests__/personalization.test.ts asserts the two lists agree, so
// a rename in one place fails the test instead of silently drifting.
export const STYLIST_NAMES: string[] = [
  "Amelia Brooks",
  "Sofia Reyes",
  "Maya Chen",
  "Jordan Lee",
  "Priya Nair",
];

// --- Validation -----------------------------------------------------------
// Never trust stored input: localStorage and the API body can hold
// anything. Unknown values fall back to the default for that field
// (parsePreferences); the API route uses validatePreferencesStrict,
// which rejects unknown values with a 400 instead.

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}

export function isFontPairingId(value: unknown): value is FontPairingId {
  return typeof value === "string" && (FONT_PAIRING_IDS as string[]).includes(value);
}

export function isFontSizeId(value: unknown): value is FontSizeId {
  return typeof value === "string" && (FONT_SIZE_IDS as string[]).includes(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** A voice identifier: null (legacy never-set — accepted at the
 * boundary and resolved to the default voice by parsePreferences),
 * "" (the explicit browser default, what "Default voice" in the
 * picker stores), or a voiceURI / name string. */
export function isVoiceURI(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** A voice rate or pitch: a finite number inside the valid range. */
export function isVoiceRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= VOICE_RATE_MIN &&
    value <= VOICE_RATE_MAX
  );
}

export function isVoicePitch(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= VOICE_PITCH_MIN &&
    value <= VOICE_PITCH_MAX
  );
}

/** A preferred stylist: null (no preference) or one of the five names. */
export function isPreferredStylist(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && STYLIST_NAMES.includes(value));
}

/** Lenient parse: unknown/missing fields become the default. */
export function parsePreferences(input: unknown): PersonalizationPreferences {
  const obj =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  // The voice block. null is the legacy never-set value: rows
  // saved before the Samantha default (and old localStorage) hold
  // voice_uri NULL, because the default voice used to be null.
  // It resolves to the default voice, Samantha — "" is the
  // explicit browser default and stays "". A stored pitch of 1
  // paired with a never-set voice is the old default too (the
  // default pitch was 1 before it became High 1.25), so it
  // resolves to 1.25 as well; a pitch of 1 saved next to a real
  // voice stays — the customer engaged with the voice settings,
  // so Normal may be an explicit choice. The API route upserts
  // the parsed result, so a legacy row is healed to Samantha /
  // High the first time it is re-saved — no migration needed
  // (the DB column defaults are never applied: rows are created
  // only by the API upsert, which specifies every column).
  const voiceNeverSet = obj.voiceURI === null;
  const voiceURI = voiceNeverSet
    ? DEFAULT_PREFERENCES.voiceURI
    : isVoiceURI(obj.voiceURI)
      ? obj.voiceURI
      : DEFAULT_PREFERENCES.voiceURI;
  const voicePitch = isVoicePitch(obj.voicePitch)
    ? voiceNeverSet && obj.voicePitch === 1
      ? DEFAULT_PREFERENCES.voicePitch
      : obj.voicePitch
    : DEFAULT_PREFERENCES.voicePitch;
  return {
    theme: isThemeId(obj.theme) ? obj.theme : DEFAULT_PREFERENCES.theme,
    fontPairing: isFontPairingId(obj.fontPairing)
      ? obj.fontPairing
      : DEFAULT_PREFERENCES.fontPairing,
    fontSize: isFontSizeId(obj.fontSize) ? obj.fontSize : DEFAULT_PREFERENCES.fontSize,
    highContrast: isBoolean(obj.highContrast)
      ? obj.highContrast
      : DEFAULT_PREFERENCES.highContrast,
    reduceMotion: isBoolean(obj.reduceMotion)
      ? obj.reduceMotion
      : DEFAULT_PREFERENCES.reduceMotion,
    largerText: isBoolean(obj.largerText)
      ? obj.largerText
      : DEFAULT_PREFERENCES.largerText,
    voiceURI,
    voiceRate: isVoiceRate(obj.voiceRate)
      ? obj.voiceRate
      : DEFAULT_PREFERENCES.voiceRate,
    voicePitch,
    preferredStylist: isPreferredStylist(obj.preferredStylist)
      ? obj.preferredStylist
      : DEFAULT_PREFERENCES.preferredStylist,
    emailNotifications: isBoolean(obj.emailNotifications)
      ? obj.emailNotifications
      : DEFAULT_PREFERENCES.emailNotifications,
  };
}

/** Strict validation for the API route: unknown values are errors. */
export function validatePreferencesStrict(input: unknown): {
  ok: boolean;
  errors: string[];
  preferences: PersonalizationPreferences;
} {
  const obj =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const errors: string[] = [];
  if (obj.theme !== undefined && !isThemeId(obj.theme)) {
    errors.push(`Unknown theme: ${String(obj.theme)}`);
  }
  if (obj.fontPairing !== undefined && !isFontPairingId(obj.fontPairing)) {
    errors.push(`Unknown font pairing: ${String(obj.fontPairing)}`);
  }
  if (obj.fontSize !== undefined && !isFontSizeId(obj.fontSize)) {
    errors.push(`Unknown font size: ${String(obj.fontSize)}`);
  }
  for (const key of ["highContrast", "reduceMotion", "largerText"] as const) {
    if (obj[key] !== undefined && !isBoolean(obj[key])) {
      errors.push(`${key} must be true or false`);
    }
  }
  if (obj.voiceURI !== undefined && !isVoiceURI(obj.voiceURI)) {
    errors.push(
      `voiceURI must be a voice id string (empty string = browser default) or null (legacy, resolves to the default voice)`,
    );
  }
  if (obj.voiceRate !== undefined && !isVoiceRate(obj.voiceRate)) {
    errors.push(
      `voiceRate must be a number between ${VOICE_RATE_MIN} and ${VOICE_RATE_MAX}`,
    );
  }
  if (obj.voicePitch !== undefined && !isVoicePitch(obj.voicePitch)) {
    errors.push(
      `voicePitch must be a number between ${VOICE_PITCH_MIN} and ${VOICE_PITCH_MAX}`,
    );
  }
  if (obj.preferredStylist !== undefined && !isPreferredStylist(obj.preferredStylist)) {
    errors.push(
      `preferredStylist must be one of: ${STYLIST_NAMES.join(", ")} (or null for no preference)`,
    );
  }
  if (obj.emailNotifications !== undefined && !isBoolean(obj.emailNotifications)) {
    errors.push(`emailNotifications must be true or false`);
  }
  return { ok: errors.length === 0, errors, preferences: parsePreferences(obj) };
}

// --- Browser chrome colour (theme-color) ----------------------------------
// The <meta name="theme-color"> tag is the hint Safari and Chrome
// use to tint the browser chrome (Safari tab bar, mobile
// Safari/Chrome address bar). It is a hint, not a command: browsers
// may tint the chrome but desktop behaviour varies, and it never
// recolours the whole browser window. The value here is the theme's
// header background (--nav-bg) for the current light/dark mode, so
// the chrome matches the header the customer sees. It is updated
// whenever the theme or the light/dark mode changes (see
// applyPreferences + syncThemeColorMeta + the MutationObserver in
// components/PersonalizationProvider.tsx) and before first paint by
// the pre-paint script below, so the chrome never shows the wrong
// colour on load. The update REPLACES the tag with a fresh node
// rather than changing its content attribute in place: Safari on
// macOS does not reliably re-tint the tab bar when the attribute
// is mutated — it only picks the new colour up on reload — while
// inserting a fresh tag forces Safari to re-read it, so the chrome
// follows a theme change immediately, without a reload. Live
// re-tinting on desktop Safari cannot be verified in the workspace
// (no Safari here); confirm by eye on a Mac.

/** Header background for a theme + mode — the theme-color value. */
export function themeColorFor(theme: ThemeId, dark: boolean): string {
  const def = THEMES[theme] ?? THEMES.plum;
  return dark ? def.navBgDark : def.navBgLight;
}

/**
 * Write the theme-color meta tag to match the theme and light/dark
 * mode currently on <html>. Creates the tag if it is missing (the
 * layout renders it, so this is only a fallback). No-op when there
 * is no document (server render).
 *
 * The tag is REPLACED with a fresh node on every sync, not mutated
 * in place: Safari on macOS does not reliably re-tint the tab bar
 * when the meta tag's content attribute changes — it only picks
 * the new colour up on reload. Removing the old tag and inserting
 * a new one forces Safari to re-read it, so the chrome follows a
 * theme change immediately, without a reload. (Live re-tinting
 * cannot be verified in the workspace — no Safari here; confirm
 * by eye on a Mac: pick a theme in /settings and watch the tab
 * bar tint change without reloading.)
 */
export function syncThemeColorMeta(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const themeAttr = el.getAttribute("data-personalization-theme");
  const theme: ThemeId = isThemeId(themeAttr) ? themeAttr : "plum";
  const dark = el.getAttribute("data-theme") === "dark";
  const color = themeColorFor(theme, dark);
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", color);
  const old = document.querySelector('meta[name="theme-color"]');
  if (old) {
    old.replaceWith(meta);
  } else {
    document.head.appendChild(meta);
  }
}

// --- Storage + application ------------------------------------------------

/** Read the saved preferences from localStorage (defaults on any failure). */
export function readStoredPreferences(): PersonalizationPreferences {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_PREFERENCES };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return parsePreferences(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Write preferences to localStorage. Never throws (private mode, quota). */
export function writeStoredPreferences(prefs: PersonalizationPreferences): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — the in-memory choice still applies.
  }
}

/**
 * Apply preferences to <html> as data attributes. The CSS in
 * app/globals.css reads these; the pre-paint script
 * (PERSONALIZATION_PREPAINT_SCRIPT) sets the same attributes before
 * first paint so there is no flash of the default theme. The
 * browser chrome colour (theme-color meta tag) is synced here too,
 * so it follows the theme — and the light/dark mode, which the
 * MutationObserver in components/PersonalizationProvider.tsx
 * watches for (toggling dark mode does not call this function).
 */
export function applyPreferences(prefs: PersonalizationPreferences): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-personalization-theme", prefs.theme);
  el.setAttribute("data-font-pairing", prefs.fontPairing);
  el.setAttribute("data-font-size", prefs.fontSize);
  el.setAttribute("data-high-contrast", String(prefs.highContrast));
  el.setAttribute("data-reduce-motion", String(prefs.reduceMotion));
  el.setAttribute("data-larger-text", String(prefs.largerText));
  syncThemeColorMeta();
}

// Pre-paint script (mirrors the dark-mode THEME_SCRIPT in
// app/layout.tsx): reads localStorage "lumen-preferences" BEFORE first
// paint and sets the same data attributes applyPreferences sets, so
// the page never flashes the default plum theme. It validates every
// value against the allowlists inline (never trust stored input) and
// falls back to the defaults on any failure. The coordinator renders
// it via <PersonalizationScript /> — see PERSONALIZATION.md.
export const PERSONALIZATION_PREPAINT_SCRIPT = `(function(){try{var d=${JSON.stringify(DEFAULT_PREFERENCES)};var raw=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(raw){try{var p=JSON.parse(raw);if(p&&typeof p==="object"){if(["plum","rose","teal","forest","navy","purple","orange-blue","yellow"].indexOf(p.theme)>=0)d.theme=p.theme;if(["classic","clean","readable"].indexOf(p.fontPairing)>=0)d.fontPairing=p.fontPairing;if(["small","medium","large"].indexOf(p.fontSize)>=0)d.fontSize=p.fontSize;if(typeof p.highContrast==="boolean")d.highContrast=p.highContrast;if(typeof p.reduceMotion==="boolean")d.reduceMotion=p.reduceMotion;if(typeof p.largerText==="boolean")d.largerText=p.largerText;}}catch(e){}}var el=document.documentElement;el.setAttribute("data-personalization-theme",d.theme);el.setAttribute("data-font-pairing",d.fontPairing);el.setAttribute("data-font-size",d.fontSize);el.setAttribute("data-high-contrast",String(d.highContrast));el.setAttribute("data-reduce-motion",String(d.reduceMotion));el.setAttribute("data-larger-text",String(d.largerText));var dark=el.getAttribute(\"data-theme\")===\"dark\";var tc={plum:[\"#3d2433\",\"#a05a66\"],rose:[\"#4a1524\",\"#9c3d54\"],teal:[\"#0b3d3a\",\"#0f766e\"],forest:[\"#0f2e1d\",\"#166534\"],navy:[\"#101f33\",\"#1e3a5f\"],purple:[\"#3b0764\",\"#7c3aed\"],\"orange-blue\":[\"#0f2a44\",\"#c2410c\"],yellow:[\"#eab308\",\"#a16207\"]};var c=(tc[d.theme]||tc.plum)[dark?1:0];var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute(\"content\",c);}catch(e){}})();`;

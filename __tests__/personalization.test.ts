// lib/personalization.ts — themes, validation, storage helpers and
// the font-size scale. No Supabase, no DOM beyond document/localStorage.
import {
  DEFAULT_PREFERENCES,
  FONT_SIZES,
  THEMES,
  applyPreferences,
  contrastRatio,
  parsePreferences,
  readStoredPreferences,
  validatePreferencesStrict,
  writeStoredPreferences,
  STORAGE_KEY,
} from "@/lib/personalization";

describe("theme contrast (WCAG 2.1 AA, bar 4.5:1)", () => {
  it.each(Object.values(THEMES))(
    "$id: white on accent / deep / hover, header light + dark, and accent text on both pages are all >= 4.5:1",
    (t) => {
      expect(t.contrast.whiteOnAccent).toBeGreaterThanOrEqual(4.5);
      expect(t.contrast.whiteOnDeep).toBeGreaterThanOrEqual(4.5);
      expect(t.contrast.whiteOnHover).toBeGreaterThanOrEqual(4.5);
      expect(t.contrast.headerLight).toBeGreaterThanOrEqual(4.5);
      expect(t.contrast.headerDark).toBeGreaterThanOrEqual(4.5);
      expect(t.contrast.textOnPageLight).toBeGreaterThanOrEqual(4.5);
      expect(t.contrast.textOnPageDark).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("re-computes the headline ratios from the hex values (not from the stored numbers)", () => {
    // Plum is the site's existing theme, unchanged.
    expect(contrastRatio("#ffffff", "#a05a66")).toBeCloseTo(5.06, 1);
    expect(contrastRatio("#fdf8f1", "#3d2433")).toBeCloseTo(13.26, 1);
    // The other four accents, white on accent.
    expect(contrastRatio("#ffffff", THEMES.rose.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", THEMES.teal.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", THEMES.forest.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", THEMES.navy.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("contrastRatio is symmetric and 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });
});

describe("preference validation", () => {
  it("parsePreferences fills defaults for missing fields", () => {
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("nope")).toEqual(DEFAULT_PREFERENCES);
  });

  it("parsePreferences keeps valid values and replaces unknown ones with defaults", () => {
    const parsed = parsePreferences({
      theme: "teal",
      fontPairing: "bogus",
      fontSize: "huge",
      highContrast: "yes",
      reduceMotion: true,
      largerText: false,
    });
    expect(parsed.theme).toBe("teal");
    expect(parsed.fontPairing).toBe("classic");
    expect(parsed.fontSize).toBe("medium");
    expect(parsed.highContrast).toBe(false);
    expect(parsed.reduceMotion).toBe(true);
  });

  it("validatePreferencesStrict rejects unknown theme/font/size values", () => {
    const bad = validatePreferencesStrict({
      theme: "magenta",
      fontPairing: "comic",
      fontSize: "tiny",
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/theme/);
    expect(bad.errors.join(" ")).toMatch(/font pairing/);
    expect(bad.errors.join(" ")).toMatch(/font size/);
  });

  it("validatePreferencesStrict rejects non-boolean accessibility flags", () => {
    const bad = validatePreferencesStrict({ highContrast: "yes" });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/highContrast/);
  });

  it("validatePreferencesStrict accepts a full valid set and partial updates", () => {
    expect(
      validatePreferencesStrict({
        theme: "forest",
        fontPairing: "readable",
        fontSize: "large",
        highContrast: true,
        reduceMotion: false,
        largerText: true,
      }).ok,
    ).toBe(true);
    // A partial body (only the changed field) is a valid update.
    const partial = validatePreferencesStrict({ theme: "navy" });
    expect(partial.ok).toBe(true);
    expect(partial.preferences.theme).toBe("navy");
    expect(partial.preferences.fontSize).toBe("medium");
  });
});

describe("font-size scaling values", () => {
  it("small < medium < large on body, heading and button sizes", () => {
    expect(FONT_SIZES.small.bodyPx).toBeLessThan(FONT_SIZES.medium.bodyPx);
    expect(FONT_SIZES.medium.bodyPx).toBeLessThan(FONT_SIZES.large.bodyPx);
    expect(FONT_SIZES.small.headingPx).toBeLessThan(FONT_SIZES.medium.headingPx);
    expect(FONT_SIZES.medium.headingPx).toBeLessThan(FONT_SIZES.large.headingPx);
    expect(FONT_SIZES.small.buttonPx).toBeLessThan(FONT_SIZES.medium.buttonPx);
    expect(FONT_SIZES.medium.buttonPx).toBeLessThan(FONT_SIZES.large.buttonPx);
  });

  it("medium matches the site's current sizes (16px body, 34px h2, 14px button)", () => {
    expect(FONT_SIZES.medium).toEqual({
      id: "medium",
      label: "Medium",
      bodyPx: 16,
      headingPx: 34,
      buttonPx: 14,
    });
  });
});

describe("localStorage read/write helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readStoredPreferences returns defaults with nothing stored", () => {
    expect(readStoredPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("write then read round-trips the preferences", () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      theme: "teal" as const,
      fontSize: "large" as const,
      highContrast: true,
    };
    writeStoredPreferences(prefs);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("teal");
    expect(readStoredPreferences()).toEqual(prefs);
  });

  it("corrupt or hostile stored JSON falls back to defaults, never throws", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readStoredPreferences()).toEqual(DEFAULT_PREFERENCES);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "magenta", fontSize: "tiny" }),
    );
    expect(readStoredPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("applyPreferences sets all six data attributes on <html>", () => {
    applyPreferences({
      theme: "forest",
      fontPairing: "clean",
      fontSize: "small",
      highContrast: true,
      reduceMotion: true,
      largerText: false,
    });
    const el = document.documentElement;
    expect(el.getAttribute("data-personalization-theme")).toBe("forest");
    expect(el.getAttribute("data-font-pairing")).toBe("clean");
    expect(el.getAttribute("data-font-size")).toBe("small");
    expect(el.getAttribute("data-high-contrast")).toBe("true");
    expect(el.getAttribute("data-reduce-motion")).toBe("true");
    expect(el.getAttribute("data-larger-text")).toBe("false");
  });
});

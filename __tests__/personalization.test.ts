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
  syncThemeColorMeta,
  themeColorFor,
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

describe("voice options", () => {
  it("defaults are the browser default voice, normal speed and pitch", () => {
    expect(DEFAULT_PREFERENCES.voiceURI).toBeNull();
    expect(DEFAULT_PREFERENCES.voiceRate).toBe(1);
    expect(DEFAULT_PREFERENCES.voicePitch).toBe(1);
  });

  it("parsePreferences keeps valid voice values and defaults the rest", () => {
    const parsed = parsePreferences({
      voiceURI: "com.apple.speech.synthesis.voice.samantha",
      voiceRate: 1.25,
      voicePitch: 0.75,
    });
    expect(parsed.voiceURI).toBe("com.apple.speech.synthesis.voice.samantha");
    expect(parsed.voiceRate).toBe(1.25);
    expect(parsed.voicePitch).toBe(0.75);
    const bad = parsePreferences({
      voiceURI: 42,
      voiceRate: 5,
      voicePitch: "high",
    });
    expect(bad.voiceURI).toBeNull();
    expect(bad.voiceRate).toBe(1);
    expect(bad.voicePitch).toBe(1);
  });

  it("validatePreferencesStrict rejects out-of-range rate/pitch and non-string voiceURI", () => {
    const bad = validatePreferencesStrict({
      voiceURI: 42,
      voiceRate: 0.1,
      voicePitch: 3,
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/voiceURI/);
    expect(bad.errors.join(" ")).toMatch(/voiceRate/);
    expect(bad.errors.join(" ")).toMatch(/voicePitch/);
  });

  it("validatePreferencesStrict accepts a full valid voice set and partial updates", () => {
    expect(
      validatePreferencesStrict({
        voiceURI: "Google US English",
        voiceRate: 0.75,
        voicePitch: 1.25,
      }).ok,
    ).toBe(true);
    expect(validatePreferencesStrict({ voiceURI: null }).ok).toBe(true);
    const partial = validatePreferencesStrict({ voiceRate: 1.25 });
    expect(partial.ok).toBe(true);
    expect(partial.preferences.voiceRate).toBe(1.25);
    expect(partial.preferences.voicePitch).toBe(1);
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

describe("browser chrome colour (theme-color meta tag)", () => {  // The chrome colour is the theme's header background, so the
  // browser tab/address bar matches the header the customer sees.
  it("themeColorFor is the header background for each theme and mode", () => {
    expect(themeColorFor("plum", false)).toBe("#3d2433");
    expect(themeColorFor("plum", true)).toBe("#a05a66");
    expect(themeColorFor("rose", false)).toBe("#4a1524");
    expect(themeColorFor("rose", true)).toBe("#9c3d54");
    expect(themeColorFor("teal", false)).toBe("#0b3d3a");
    expect(themeColorFor("teal", true)).toBe("#0f766e");
    expect(themeColorFor("forest", false)).toBe("#0f2e1d");
    expect(themeColorFor("forest", true)).toBe("#166534");
    expect(themeColorFor("navy", false)).toBe("#101f33");
    expect(themeColorFor("navy", true)).toBe("#1e3a5f");
  });

  it("themeColorFor agrees with the theme's nav-bg fields", () => {
    for (const t of Object.values(THEMES)) {
      expect(themeColorFor(t.id, false)).toBe(t.navBgLight);
      expect(themeColorFor(t.id, true)).toBe(t.navBgDark);
    }
  });

  function metaTag(): HTMLMetaElement {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    return meta;
  }

  it("syncThemeColorMeta writes the tag from the theme + mode on <html>", () => {
    const el = document.documentElement;
    el.setAttribute("data-personalization-theme", "navy");
    el.setAttribute("data-theme", "dark");
    syncThemeColorMeta();
    expect(metaTag().getAttribute("content")).toBe("#1e3a5f");
    el.setAttribute("data-theme", "light");
    syncThemeColorMeta();
    expect(metaTag().getAttribute("content")).toBe("#101f33");
  });

  it("applyPreferences syncs the theme-color tag as well as the data attributes", () => {
    document.documentElement.setAttribute("data-theme", "light");
    applyPreferences({ ...DEFAULT_PREFERENCES, theme: "teal" });
    expect(metaTag().getAttribute("content")).toBe("#0b3d3a");
  });

  it("syncThemeColorMeta creates the tag when it is missing", () => {
    document.querySelector('meta[name="theme-color"]')?.remove();
    document.documentElement.setAttribute("data-personalization-theme", "rose");
    document.documentElement.setAttribute("data-theme", "light");
    syncThemeColorMeta();
    expect(metaTag().getAttribute("content")).toBe("#4a1524");
  });
});

describe("font-size scaling (rem, root font-size)", () => {
  // The size choice sets the root font-size on <html> and every
  // text size in app/globals.css is in rem, so the whole site
  // scales — body, headings, buttons, inputs, tables, the brand,
  // hero text, chat messages, review stars, badges, the small
  // muted notes, the hamburger menu and the nav. jsdom does not
  // apply the stylesheet, so this guards the CSS itself: the root
  // rules exist with the right px values, and no other font-size
  // is in px (a px font-size would not scale with the root).
  function globalsCss(): string {
    const fs = require("fs");
    const path = require("path");
    return fs.readFileSync(
      path.join(__dirname, "..", "app", "globals.css"),
      "utf8"
    ) as string;
  }

  it("the root font-size rules exist for small, large and larger-text", () => {
    const css = globalsCss();
    expect(css).toContain('html[data-font-size="small"] { font-size: 15px; }');
    expect(css).toContain('html[data-font-size="large"] { font-size: 18px; }');
    expect(css).toContain('html[data-larger-text="true"] { font-size: 19px; }');
  });

  it("no font-size outside the root rules is in px", () => {
    const css = globalsCss();
    const pxSizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(
      (m) => m[0]
    );
    // Only the three root rules above may use px.
    expect(pxSizes).toHaveLength(3);
    expect(pxSizes).toEqual([
      "font-size: 15px",
      "font-size: 18px",
      "font-size: 19px",
    ]);
  });

  it("the hero h1 clamp uses rem, so it scales with the root", () => {
    const css = globalsCss();
    const h1 = css.match(/\.hero-content h1 \{[^}]*\}/);
    expect(h1).not.toBeNull();
    expect(h1![0]).toContain("clamp(2.5rem, 6vw, 4rem)");
  });
});

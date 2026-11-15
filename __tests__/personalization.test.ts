// lib/personalization.ts — themes, validation, storage helpers and
// the font-size scale. No Supabase, no DOM beyond document/localStorage.
import {
  DEFAULT_PREFERENCES,
  FONT_SIZES,
  PERSONALIZATION_PREPAINT_SCRIPT,
  STYLIST_NAMES,
  THEMES,
  THEME_IDS,
  applyPreferences,
  contrastRatio,
  isPreferredStylist,
  parsePreferences,
  readStoredPreferences,
  syncThemeColorMeta,
  themeColorFor,
  validatePreferencesStrict,
  writeStoredPreferences,
  STORAGE_KEY,
} from "@/lib/personalization";
import { EMPLOYEES } from "@/lib/dashboard";

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
    // The three new accents, white on accent.
    expect(contrastRatio("#ffffff", THEMES.purple.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", THEMES["orange-blue"].accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", THEMES.yellow.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("contrastRatio is symmetric and 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("there are eight themes, each with a definition", () => {
    expect(THEME_IDS).toHaveLength(8);
    expect(THEME_IDS).toEqual([
      "plum",
      "rose",
      "teal",
      "forest",
      "navy",
      "purple",
      "orange-blue",
      "yellow",
    ]);
    for (const id of THEME_IDS) {
      expect(THEMES[id]).toBeDefined();
      expect(THEMES[id].id).toBe(id);
    }
  });

  it("Yellow's light header uses dark text, not cream (cream on bright yellow is 1.81:1)", () => {
    // Yellow is the one theme whose light-mode header text is not
    // cream: the bright yellow header needs dark text to pass AA.
    expect(THEMES.yellow.navFgLight).toBe("#1a0f16");
    expect(THEMES.yellow.contrast.headerLight).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#fdf8f1", THEMES.yellow.navBgLight)).toBeLessThan(4.5);
    for (const t of Object.values(THEMES)) {
      if (t.id === "yellow") continue;
      expect(t.navFgLight).toBe("#fdf8f1");
    }
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
  it("defaults are Samantha, normal speed and a high pitch", () => {
    expect(DEFAULT_PREFERENCES.voiceURI).toBe("Samantha");
    expect(DEFAULT_PREFERENCES.voiceRate).toBe(1);
    expect(DEFAULT_PREFERENCES.voicePitch).toBe(1.25);
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
    expect(bad.voiceURI).toBe("Samantha");
    expect(bad.voiceRate).toBe(1);
    expect(bad.voicePitch).toBe(1.25);
  });

  it("a stored preference with no voice fields parses to the voice defaults", () => {
    const parsed = parsePreferences({ theme: "teal", fontSize: "large" });
    expect(parsed.theme).toBe("teal");
    expect(parsed.fontSize).toBe("large");
    expect(parsed.voiceURI).toBe("Samantha");
    expect(parsed.voiceRate).toBe(1);
    expect(parsed.voicePitch).toBe(1.25);
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
    expect(partial.preferences.voicePitch).toBe(1.25);
  });

  it("a NULL voice_uri (legacy never-set row) resolves to Samantha", () => {
    // Rows saved before the Samantha default hold voice_uri NULL
    // (the default voice used to be null). They must get Samantha
    // — the customer never picked anything, so the default applies.
    const parsed = parsePreferences({
      theme: "teal",
      voiceURI: null,
      voiceRate: 1,
      voicePitch: 1,
    });
    expect(parsed.voiceURI).toBe("Samantha");
    // The API route upserts the parsed result, so a POST of the
    // same legacy values heals the row instead of re-storing null.
    const validated = validatePreferencesStrict({
      voiceURI: null,
      voiceRate: 1,
      voicePitch: 1,
    });
    expect(validated.ok).toBe(true);
    expect(validated.preferences.voiceURI).toBe("Samantha");
  });

  it('an explicit "Default voice" ("") still gives the browser default', () => {
    // "" is the sentinel the picker stores for "Default voice".
    // It must survive the parse untouched — it is a real choice,
    // not a missing value — and the API must accept it.
    const parsed = parsePreferences({ voiceURI: "", voiceRate: 1, voicePitch: 1.25 });
    expect(parsed.voiceURI).toBe("");
    const validated = validatePreferencesStrict({ voiceURI: "" });
    expect(validated.ok).toBe(true);
    expect(validated.preferences.voiceURI).toBe("");
  });

  it("a saved specific voice is preserved", () => {
    const parsed = parsePreferences({
      voiceURI: "com.apple.speech.synthesis.voice.daniel",
      voiceRate: 1,
      voicePitch: 1,
    });
    expect(parsed.voiceURI).toBe("com.apple.speech.synthesis.voice.daniel");
    // And its pitch: a Normal pitch next to a real voice is an
    // explicit choice, not the old default — it stays 1.
    expect(parsed.voicePitch).toBe(1);
  });

  it("a fresh preference (no row) gives Samantha, Normal speed, High pitch", () => {
    // GET /api/preferences with no row returns DEFAULT_PREFERENCES,
    // and parsePreferences({}) is the same shape.
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES.voiceURI).toBe("Samantha");
    expect(DEFAULT_PREFERENCES.voiceRate).toBe(1);
    expect(DEFAULT_PREFERENCES.voicePitch).toBe(1.25);
  });

  it("a stored pitch of 1 resolves to High only when the voice was never set", () => {
    // The rule, pinned: the old default pitch was 1, so a 1 saved
    // next to a never-set voice (null) is the old default and
    // becomes High 1.25. A 1 saved next to a real voice — or next
    // to an explicit "Default voice" ("") — stays Normal.
    expect(parsePreferences({ voiceURI: null, voicePitch: 1 }).voicePitch).toBe(1.25);
    expect(
      parsePreferences({ voiceURI: "Daniel", voicePitch: 1 }).voicePitch,
    ).toBe(1);
    expect(parsePreferences({ voiceURI: "", voicePitch: 1 }).voicePitch).toBe(1);
    // Any other stored pitch is kept as-is, whatever the voice.
    expect(parsePreferences({ voiceURI: null, voicePitch: 0.75 }).voicePitch).toBe(0.75);
    expect(parsePreferences({ voiceURI: null, voicePitch: 1.25 }).voicePitch).toBe(1.25);
  });

  it("a legacy localStorage row (voiceURI null) round-trips to Samantha", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceURI: null, voicePitch: 1 }),
    );
    const stored = readStoredPreferences();
    expect(stored.voiceURI).toBe("Samantha");
    expect(stored.voicePitch).toBe(1.25);
    // And writing it back stores Samantha, never null again.
    writeStoredPreferences(stored);
    const written = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(written.voiceURI).toBe("Samantha");
    expect(written.voicePitch).toBe(1.25);
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
    expect(themeColorFor("purple", false)).toBe("#3b0764");
    expect(themeColorFor("purple", true)).toBe("#7c3aed");
    expect(themeColorFor("orange-blue", false)).toBe("#0f2a44");
    expect(themeColorFor("orange-blue", true)).toBe("#c2410c");
    expect(themeColorFor("yellow", false)).toBe("#eab308");
    expect(themeColorFor("yellow", true)).toBe("#a16207");
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

  it("syncThemeColorMeta replaces the tag with a fresh node, not a mutation in place", () => {
    // Safari on macOS does not reliably re-tint the tab bar when
    // the meta tag's content attribute is mutated — it only picks
    // the new colour up on reload. Inserting a fresh tag forces
    // Safari to re-read it, so the chrome follows a theme change
    // immediately, without a reload.
    document.documentElement.setAttribute("data-personalization-theme", "plum");
    document.documentElement.setAttribute("data-theme", "light");
    syncThemeColorMeta();
    const first = metaTag();
    expect(first.getAttribute("content")).toBe("#3d2433");
    document.documentElement.setAttribute("data-personalization-theme", "teal");
    syncThemeColorMeta();
    const second = metaTag();
    expect(second.getAttribute("content")).toBe("#0b3d3a");
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });

  it("the pre-paint script knows all eight themes (allowlist + chrome map)", () => {
    // The script is a string constant with the theme list inlined
    // twice: the allowlist it validates the stored theme against,
    // and the theme-color map (light + dark nav-bg per theme). Both
    // must stay in step with THEMES, or a new theme would silently
    // fall back to plum before first paint.
    for (const id of THEME_IDS) {
      expect(PERSONALIZATION_PREPAINT_SCRIPT).toContain(`"${id}"`);
    }
    expect(PERSONALIZATION_PREPAINT_SCRIPT).toContain('#3b0764');
    expect(PERSONALIZATION_PREPAINT_SCRIPT).toContain('#7c3aed');
    expect(PERSONALIZATION_PREPAINT_SCRIPT).toContain('#0f2a44');
    expect(PERSONALIZATION_PREPAINT_SCRIPT).toContain('#c2410c');
    expect(PERSONALIZATION_PREPAINT_SCRIPT).toContain('#eab308');
    expect(PERSONALIZATION_PREPAINT_SCRIPT).toContain('#a16207');
  });

  it("the pre-paint script applies a saved new theme before first paint", () => {
    // Run the actual script string in jsdom with a saved Yellow
    // theme and check the attributes + chrome colour it sets.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "yellow" }),
    );
    document.documentElement.setAttribute("data-theme", "light");
    // eslint-disable-next-line no-eval
    eval(PERSONALIZATION_PREPAINT_SCRIPT);
    expect(
      document.documentElement.getAttribute("data-personalization-theme"),
    ).toBe("yellow");
    expect(metaTag().getAttribute("content")).toBe("#eab308");
    // And an unknown stored theme still falls back to plum.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "magenta" }),
    );
    // eslint-disable-next-line no-eval
    eval(PERSONALIZATION_PREPAINT_SCRIPT);
    expect(
      document.documentElement.getAttribute("data-personalization-theme"),
    ).toBe("plum");
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

  it("selects scale with the root font-size (1rem), not the UA fixed size", () => {
    // Safari's UA stylesheet gives <select> a fixed size
    // (font: -webkit-small-control) that ignores the root
    // font-size — without this rule the settings-panel dropdowns
    // (voice, speed, pitch, stylist), the reschedule time picker
    // and the owner selects stay the same size when the customer
    // changes the font size. The lead-form selects already had
    // 1rem; this rule agrees with them (same value).
    const css = globalsCss();
    const rule = css.match(/select\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("font-size: 1rem");
  });
});

describe("settings page fields (preferred stylist + email notifications)", () => {
  it("defaults are no preferred stylist and email notifications on", () => {
    expect(DEFAULT_PREFERENCES.preferredStylist).toBeNull();
    expect(DEFAULT_PREFERENCES.emailNotifications).toBe(true);
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it("parsePreferences keeps a valid stylist and a false notifications flag", () => {
    const parsed = parsePreferences({
      preferredStylist: "Maya Chen",
      emailNotifications: false,
    });
    expect(parsed.preferredStylist).toBe("Maya Chen");
    expect(parsed.emailNotifications).toBe(false);
  });

  it("parsePreferences replaces an unknown stylist and a non-boolean flag with defaults", () => {
    const parsed = parsePreferences({
      preferredStylist: "Someone Else",
      emailNotifications: "yes",
    });
    expect(parsed.preferredStylist).toBeNull();
    expect(parsed.emailNotifications).toBe(true);
  });

  it("validatePreferencesStrict rejects an unknown stylist and a non-boolean flag", () => {
    const bad = validatePreferencesStrict({
      preferredStylist: "Someone Else",
      emailNotifications: "yes",
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/preferredStylist/);
    expect(bad.errors.join(" ")).toMatch(/emailNotifications/);
  });

  it("validatePreferencesStrict accepts null (no preference) and a valid stylist", () => {
    expect(validatePreferencesStrict({ preferredStylist: null }).ok).toBe(true);
    expect(
      validatePreferencesStrict({
        preferredStylist: "Amelia Brooks",
        emailNotifications: false,
      }).ok,
    ).toBe(true);
  });

  it("STYLIST_NAMES is the five stylists from the dashboard, in the same set", () => {
    // The source of truth is EMPLOYEES in lib/dashboard.ts; the
    // list here is a deliberate duplicate (so this client-safe file
    // does not import the 1,377-row SALES data). A rename in either
    // place must fail here, not drift silently.
    expect([...STYLIST_NAMES].sort()).toEqual(
      EMPLOYEES.map((e) => e.name).sort(),
    );
    expect(isPreferredStylist("Jordan Lee")).toBe(true);
    expect(isPreferredStylist("Nobody")).toBe(false);
  });
});

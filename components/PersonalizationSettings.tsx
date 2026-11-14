// Personalisation settings for the customer area (/my-account).
// A colour-theme picker (5 swatches), a font-pairing choice, a
// font-size choice and three accessibility toggles. Every control is
// a real radio input or checkbox with a label, so the whole panel
// works by keyboard alone and the selected option is announced.
//
// Behaviour: on mount it reads localStorage, applies it at once,
// then asks GET /api/preferences. When the account has saved
// preferences they win (they follow the customer across devices) and
// are written back to localStorage. Every change applies immediately
// (so the customer sees the effect at once), is saved to
// localStorage always, and is POSTed to /api/preferences when the
// account sync is available. Signed out, or with Supabase
// unconfigured, it is localStorage only and says so — it never
// errors in that case.
"use client";

import { useEffect, useRef, useState } from "react";
import {
  FONT_PAIRINGS,
  FONT_PAIRING_IDS,
  FONT_SIZES,
  FONT_SIZE_IDS,
  THEMES,
  THEME_IDS,
  applyPreferences,
  readStoredPreferences,
  writeStoredPreferences,
  type PersonalizationPreferences,
} from "@/lib/personalization";

type SyncState = "unknown" | "account" | "device-only";

export default function PersonalizationSettings() {
  const [prefs, setPrefs] = useState<PersonalizationPreferences>(() =>
    readStoredPreferences(),
  );
  const [sync, setSync] = useState<SyncState>("unknown");
  const [status, setStatus] = useState("");
  // The account fetch must not overwrite a change the customer made
  // while it was still in flight.
  const changedRef = useRef(false);

  useEffect(() => {
    const stored = readStoredPreferences();
    applyPreferences(stored);
    setPrefs(stored);
    let cancelled = false;
    fetch("/api/preferences")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const obj =
          typeof data === "object" && data !== null
            ? (data as Record<string, unknown>)
            : {};
        if (obj.configured === false) {
          setSync("device-only");
          return;
        }
        if (obj.preferences && typeof obj.preferences === "object") {
          setSync("account");
          if (!changedRef.current) {
            const account = obj.preferences as PersonalizationPreferences;
            applyPreferences(account);
            writeStoredPreferences(account);
            setPrefs(account);
          }
        }
      })
      .catch(() => {
        // Signed out, or the route is unreachable: localStorage only.
        if (!cancelled) setSync("device-only");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function save(next: PersonalizationPreferences) {
    changedRef.current = true;
    setPrefs(next);
    applyPreferences(next);
    writeStoredPreferences(next);
    if (sync === "account") {
      setStatus("Saving…");
      fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
        .then((res) => {
          if (res.ok) setStatus("Saved to your account.");
          else if (res.status === 401) setStatus("Saved on this device only — sign in to sync it.");
          else setStatus("Saved on this device only — the account copy could not be saved.");
        })
        .catch(() => setStatus("Saved on this device only."));
    } else {
      setStatus("Saved on this device.");
    }
  }

  function update<K extends keyof PersonalizationPreferences>(
    key: K,
    value: PersonalizationPreferences[K],
  ) {
    save({ ...prefs, [key]: value });
  }

  return (
    <div className="personalization-settings">
      <fieldset>
        <legend>Colour theme</legend>
        <p>
          <small>
            Changes the header, buttons and accent colours across the
            site. Plum is the studio&apos;s own look.
          </small>
        </p>
        <div className="theme-picker">
          {THEME_IDS.map((id) => (
            <label key={id} className="theme-swatch-label">
              <input
                type="radio"
                name="personalization-theme"
                value={id}
                checked={prefs.theme === id}
                onChange={() => update("theme", id)}
              />
              <span
                className="theme-swatch"
                style={{ background: THEMES[id].accent }}
                aria-hidden="true"
              />
              {THEMES[id].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Fonts</legend>
        <div className="settings-options">
          {FONT_PAIRING_IDS.map((id) => (
            <label key={id}>
              <input
                type="radio"
                name="personalization-font"
                value={id}
                checked={prefs.fontPairing === id}
                onChange={() => update("fontPairing", id)}
              />
              <strong>{FONT_PAIRINGS[id].label}</strong> —{" "}
              {FONT_PAIRINGS[id].description}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Text size</legend>
        <div className="settings-options">
          {FONT_SIZE_IDS.map((id) => (
            <label key={id}>
              <input
                type="radio"
                name="personalization-size"
                value={id}
                checked={prefs.fontSize === id}
                onChange={() => update("fontSize", id)}
              />
              <strong>{FONT_SIZES[id].label}</strong>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Accessibility</legend>
        <div className="settings-options">
          <label>
            <input
              type="checkbox"
              checked={prefs.largerText}
              onChange={(e) => update("largerText", e.target.checked)}
            />
            <strong>Larger text</strong> — a stronger text-size boost on
            top of the text-size choice above.
          </label>
          <label>
            <input
              type="checkbox"
              checked={prefs.highContrast}
              onChange={(e) => update("highContrast", e.target.checked)}
            />
            <strong>High contrast</strong> — darker text, stronger
            borders and clearer muted text, in light and dark mode.
          </label>
          <label>
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(e) => update("reduceMotion", e.target.checked)}
            />
            <strong>Reduce motion</strong> — turns off animations,
            transitions and smooth scrolling, even if your device
            doesn&apos;t ask for it.
          </label>
        </div>
      </fieldset>

      {sync === "device-only" && (
        <p>
          <small>
            Saved on this device only — these settings will follow your
            account across devices once the studio has set up Supabase
            storage.
          </small>
        </p>
      )}
      {status && (
        <p role="status">
          <small>{status}</small>
        </p>
      )}
    </div>
  );
}

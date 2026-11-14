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
  VOICE_PITCH_OPTIONS,
  VOICE_RATE_OPTIONS,
  applyPreferences,
  readStoredPreferences,
  writeStoredPreferences,
  type PersonalizationPreferences,
} from "@/lib/personalization";
import {
  applyVoiceSettings,
  isSpeechSynthesisSupported,
} from "@/lib/speech";

type SyncState = "unknown" | "account" | "device-only";

export default function PersonalizationSettings() {
  const [prefs, setPrefs] = useState<PersonalizationPreferences>(() =>
    readStoredPreferences(),
  );
  const [sync, setSync] = useState<SyncState>("unknown");
  const [status, setStatus] = useState("");
  // The assistant's voice list comes from this browser
  // (speechSynthesis.getVoices()). It loads asynchronously, so
  // the list may be empty on first call — voiceschanged fills it
  // in. Where speech synthesis is unsupported there is no list at
  // all, and the Voice section says so instead of offering a picker.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupported, setSpeechSupported] = useState(false);
  // The account fetch must not overwrite a change the customer made
  // while it was still in flight.
  const changedRef = useRef(false);

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    setSpeechSupported(true);
    const synth = window.speechSynthesis;
    function loadVoices() {
      setVoices(synth.getVoices());
    }
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => synth.removeEventListener("voiceschanged", loadVoices);
  }, []);

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

  // Speak a short sample with the voice, speed and pitch currently
  // chosen, so the customer hears the difference at once. It uses
  // the same voice resolution as the chat (lib/speech.ts), so a
  // voice that is not on this device falls back to the default.
  // It is a one-off utterance — it does not touch the chat's speak
  // state, and the chat's next reply cancels it if one arrives.
  function previewVoice() {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(
      "Hi, I'm Lumen — your hair studio assistant. How can I help today?",
    );
    applyVoiceSettings(
      utterance,
      prefs.voiceURI,
      prefs.voiceRate,
      prefs.voicePitch,
      voices,
    );
    synth.speak(utterance);
  }

  // The saved voice may not exist on this device (it was picked
  // somewhere else). When it does not, the select shows the default
  // voice — which is what will actually speak — and this note says so.
  const savedVoiceAvailable =
    prefs.voiceURI !== null &&
    voices.some(
      (v) => v.voiceURI === prefs.voiceURI || v.name === prefs.voiceURI,
    );
  const voiceSelectValue = savedVoiceAvailable ? prefs.voiceURI : "";

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

      <fieldset>
        <legend>Voice</legend>
        <p>
          <small>
            How the assistant sounds when it reads its replies aloud.
            The voice list comes from this browser — it differs by
            browser and device.
          </small>
        </p>
        {!speechSupported ? (
          <p>
            <small>
              Voice options aren&apos;t available in this browser — the
              assistant still works by text.
            </small>
          </p>
        ) : (
          <div className="settings-options">
            <label htmlFor="voice-choice">
              <strong>Voice</strong>
            </label>
            <select
              id="voice-choice"
              value={voiceSelectValue ?? ""}
              onChange={(e) =>
                update("voiceURI", e.target.value === "" ? null : e.target.value)
              }
            >
              <option value="">Default voice</option>
              {voices.map((voice) => (
                <option
                  key={voice.voiceURI || voice.name}
                  value={voice.voiceURI || voice.name}
                >
                  {voice.name} — {voice.lang}
                </option>
              ))}
            </select>
            {prefs.voiceURI !== null && !savedVoiceAvailable && (
              <p>
                <small>
                  Your saved voice isn&apos;t available on this device —
                  using the default voice instead.
                </small>
              </p>
            )}
            <label htmlFor="voice-rate">
              <strong>Speed</strong>
            </label>
            <select
              id="voice-rate"
              value={String(prefs.voiceRate)}
              onChange={(e) => update("voiceRate", Number(e.target.value))}
            >
              {VOICE_RATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label htmlFor="voice-pitch">
              <strong>Pitch</strong>
            </label>
            <select
              id="voice-pitch"
              value={String(prefs.voicePitch)}
              onChange={(e) => update("voicePitch", Number(e.target.value))}
            >
              {VOICE_PITCH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={previewVoice}>
              Hear a preview
            </button>
          </div>
        )}
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

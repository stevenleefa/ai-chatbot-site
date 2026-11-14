// components/PersonalizationSettings.tsx — the Display settings panel
// on /my-account. Tests the behaviour only: the eight theme radios,
// font/size radios and accessibility checkboxes are real inputs with
// labels, a change applies the data attributes to <html> at once and
// persists to localStorage. The account sync (fetch /api/preferences)
// is stubbed to the signed-out shape here — the component must work
// localStorage-only and never error when the route says no.
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import PersonalizationSettings, {
  COMMON_VOICE_PLACEHOLDER_TEXT,
  LARGER_TEXT_POPOVER_DETAIL,
  LARGER_TEXT_POPOVER_TITLE,
  OTHER_VOICE_PLACEHOLDER_TEXT,
  OTHER_VOICE_PLACEHOLDER_VALUE,
} from "@/components/PersonalizationSettings";
import { STORAGE_KEY } from "@/lib/personalization";

beforeEach(() => {
  window.localStorage.clear();
  for (const attr of [
    "data-personalization-theme",
    "data-font-pairing",
    "data-font-size",
    "data-high-contrast",
    "data-reduce-motion",
    "data-larger-text",
  ]) {
    document.documentElement.removeAttribute(attr);
  }
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Sign in required." }),
    }),
  ) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PersonalizationSettings", () => {
  it("shows eight theme radios, three font pairings, three sizes and three accessibility toggles", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    for (const name of [
      "Plum",
      "Rose",
      "Teal",
      "Forest",
      "Navy",
      "Purple",
      "Orange/Blue",
      "Yellow",
    ]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: /Clean/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Readable/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Large" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /High contrast/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Reduce motion/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Larger text/ }),
    ).toBeInTheDocument();
  });

  it("picking a theme applies it to <html> at once and saves it to localStorage", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    fireEvent.click(screen.getByRole("radio", { name: "Teal" }));
    expect(document.documentElement.getAttribute("data-personalization-theme")).toBe(
      "teal",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"theme":"teal"');
    expect(screen.getByRole("radio", { name: "Teal" })).toBeChecked();
  });

  it("picking a new theme applies it to <html> at once and saves it to localStorage", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    fireEvent.click(screen.getByRole("radio", { name: "Yellow" }));
    expect(document.documentElement.getAttribute("data-personalization-theme")).toBe(
      "yellow",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"theme":"yellow"');
    expect(screen.getByRole("radio", { name: "Yellow" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Orange/Blue" }));
    expect(document.documentElement.getAttribute("data-personalization-theme")).toBe(
      "orange-blue",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain(
      '"theme":"orange-blue"',
    );
  });

  it("toggling high contrast sets the attribute and persists it", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /High contrast/ }));
    expect(document.documentElement.getAttribute("data-high-contrast")).toBe("true");
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"highContrast":true');
  });

  it("starts from the saved localStorage preferences", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: "navy",
        fontPairing: "clean",
        fontSize: "large",
        highContrast: false,
        reduceMotion: true,
        largerText: false,
      }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    expect(screen.getByRole("radio", { name: "Navy" })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Clean/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Large" })).toBeChecked();
    expect(document.documentElement.getAttribute("data-personalization-theme")).toBe(
      "navy",
    );
    expect(document.documentElement.getAttribute("data-reduce-motion")).toBe("true");
  });

  it("says the settings are saved on this device when the account sync is unavailable", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    fireEvent.click(screen.getByRole("radio", { name: "Forest" }));
    expect(screen.getByText(/Saved on this device/)).toBeInTheDocument();
  });
});

describe("Voice section", () => {
  const mockVoices = [
    { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    { voiceURI: "google-us", name: "Google US English", lang: "en-US" },
  ];

  // jsdom has no Web Speech API at all, so both speechSynthesis and
  // the utterance constructor are mocked here. The mock voices are
  // plain objects — the panel only reads voiceURI, name and lang.
  function mockSpeechSynthesis(voices = mockVoices) {
    const mock = {
      getVoices: jest.fn(() => voices),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      cancel: jest.fn(),
      speak: jest.fn(),
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: mock,
      configurable: true,
      writable: true,
    });
    class MockUtterance {
      text: string;
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    global.SpeechSynthesisUtterance =
      MockUtterance as unknown as typeof SpeechSynthesisUtterance;
    return mock;
  }

  afterEach(() => {
    // Back to the jsdom default (no speech) for the next test.
    // @ts-expect-error — deleting a window property for the test.
    delete window.speechSynthesis;
    // @ts-expect-error — deleting a global for the test.
    delete global.SpeechSynthesisUtterance;
  });

  it("says voice options are not available where speech synthesis is unsupported", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    expect(
      screen.getByText(/Voice options aren't available in this browser/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Voice")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hear a preview/ }),
    ).not.toBeInTheDocument();
  });

  it("lists the browser voices in the two dropdowns and saves the chosen one", async () => {
    mockSpeechSynthesis();
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    // Samantha is a common voice, Google US English is an other one.
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    expect(
      within(common).getByRole("option", { name: "Samantha — en-US" }),
    ).toBeInTheDocument();
    expect(
      within(other).getByRole("option", { name: "Google US English — en-US" }),
    ).toBeInTheDocument();
    fireEvent.change(other, { target: { value: "google-us" } });
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.voiceURI).toBe("google-us");
  });

  it("saves the chosen speed and pitch", async () => {
    mockSpeechSynthesis();
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    fireEvent.change(screen.getByLabelText("Speed"), {
      target: { value: "0.75" },
    });
    fireEvent.change(screen.getByLabelText("Pitch"), {
      target: { value: "1.25" },
    });
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.voiceRate).toBe(0.75);
    expect(stored.voicePitch).toBe(1.25);
  });

  it("speaks a preview with the chosen settings", async () => {
    const mock = mockSpeechSynthesis();
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    fireEvent.change(screen.getByLabelText("Speed"), {
      target: { value: "1.25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Hear a preview/ }));
    expect(mock.speak).toHaveBeenCalledTimes(1);
    const utterance = mock.speak.mock.calls[0][0] as {
      text: string;
      rate: number;
      pitch: number;
    };
    expect(utterance.text).toContain("Lumen");
    expect(utterance.rate).toBe(1.25);
    // Pitch was not changed in this test, so it is the default (High).
    expect(utterance.pitch).toBe(1.25);
  });

  it("says so when the saved voice is not on this device", async () => {
    mockSpeechSynthesis();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceURI: "a-voice-from-another-device" }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    expect(
      screen.getByText(/isn't available on this device/),
    ).toBeInTheDocument();
    // Both dropdowns fall back to the default: the Common one shows
    // "Default voice", the Other one its placeholder.
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    expect(common.value).toBe("");
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    expect(other.value).toBe("");
    expect(
      within(other).getByRole("option", {
        name: COMMON_VOICE_PLACEHOLDER_TEXT,
      }),
    ).toBeInTheDocument();
  });

  it("splits the voices: the popular five in Common, the rest in Other", async () => {
    // Browser order is scrambled and the novelty voices sit mixed
    // in with the natural ones — the dropdowns must still lead with
    // the five popular voices in curated order, and no voice may
    // appear in both dropdowns.
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "grandma-us", name: "Grandma", lang: "en-US" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
      { voiceURI: "bubbles", name: "Bubbles", lang: "en-US" },
      { voiceURI: "flo", name: "Flo", lang: "en-GB" },
      { voiceURI: "google-us", name: "Google US English", lang: "en-US" },
      { voiceURI: "moira", name: "Moira", lang: "en-IE" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
    ]);
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    // "Default voice" is still the first option in the Common dropdown.
    expect(common.options[0].value).toBe("");
    expect(common.options[0].text).toBe("Default voice");
    expect(
      within(common)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "Default voice",
      "Samantha — en-US",
      "Daniel — en-GB",
      "Moira — en-IE",
      "Flo — en-GB",
      "Grandma — en-US",
    ]);

    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    // The current voice is Samantha (the default), a common voice,
    // so the Other dropdown leads with its disabled placeholder.
    expect(
      within(other)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      COMMON_VOICE_PLACEHOLDER_TEXT,
      "Zarvox — en-US",
      "Bubbles — en-US",
      "Google US English — en-US",
    ]);

    // No voice appears twice across the two dropdowns.
    const values = [
      ...Array.from(common.options),
      ...Array.from(other.options),
    ]
      .map((o) => o.value)
      .filter((v) => v !== "" && v !== OTHER_VOICE_PLACEHOLDER_VALUE);
    expect(new Set(values).size).toBe(values.length);
  });

  it("shows only Default voice in Common when none of the five is installed", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "google-us", name: "Google US English", lang: "en-US" },
    ]);
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    // No popular voice is installed, so the Common dropdown holds
    // only "Default voice" (plus the placeholder, because the
    // default Samantha is not on this device and no other voice is
    // the current one — the current voice falls back to Default).
    expect(
      within(common)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Default voice"]);
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    expect(
      within(other)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      COMMON_VOICE_PLACEHOLDER_TEXT,
      "Zarvox — en-US",
      "Google US English — en-US",
    ]);
    expect(
      screen.getByRole("option", { name: "Default voice" }),
    ).toBeInTheDocument();
  });

  it("saves a voice picked from the Common dropdown", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    fireEvent.change(common, { target: { value: "daniel" } });
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.voiceURI).toBe("daniel");
  });

  it("shows the placeholder in the dropdown that does not hold the current voice", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    // The current voice is Zarvox, an other voice.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceURI: "zarvox" }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    expect(common.value).toBe(OTHER_VOICE_PLACEHOLDER_VALUE);
    const commonPlaceholder = within(common).getByRole("option", {
      name: OTHER_VOICE_PLACEHOLDER_TEXT,
    }) as HTMLOptionElement;
    expect(commonPlaceholder.disabled).toBe(true);
    expect(commonPlaceholder.selected).toBe(true);
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    expect(other.value).toBe("zarvox");
    // The Other dropdown has no placeholder now — it holds the
    // current voice.
    expect(
      within(other).queryByRole("option", {
        name: COMMON_VOICE_PLACEHOLDER_TEXT,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the placeholder in the Other dropdown when the current voice is common", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    // The current voice is Daniel, a common voice.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceURI: "daniel" }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    expect(common.value).toBe("daniel");
    expect(
      within(common).queryByRole("option", {
        name: OTHER_VOICE_PLACEHOLDER_TEXT,
      }),
    ).not.toBeInTheDocument();
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    expect(other.value).toBe("");
    const otherPlaceholder = within(other).getByRole("option", {
      name: COMMON_VOICE_PLACEHOLDER_TEXT,
    }) as HTMLOptionElement;
    expect(otherPlaceholder.disabled).toBe(true);
    expect(otherPlaceholder.selected).toBe(true);
  });

  it("picking a voice in either dropdown flips the other one to its placeholder", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    // Starts on Samantha (the default), a common voice.
    expect(common.value).toBe("samantha");
    expect(other.value).toBe("");
    // Pick Zarvox, an other voice: the Common dropdown flips to
    // its placeholder and the Other dropdown holds Zarvox.
    fireEvent.change(other, { target: { value: "zarvox" } });
    expect(common.value).toBe(OTHER_VOICE_PLACEHOLDER_VALUE);
    expect(other.value).toBe("zarvox");
    let stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.voiceURI).toBe("zarvox");
    // Pick Daniel, a common voice: the Other dropdown flips back
    // to its placeholder and the Common dropdown holds Daniel.
    fireEvent.change(common, { target: { value: "daniel" } });
    expect(common.value).toBe("daniel");
    expect(other.value).toBe("");
    stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.voiceURI).toBe("daniel");
  });

  it("renders the two voice dropdowns side by side in one row", async () => {
    mockSpeechSynthesis();
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const row = document.querySelector(".voice-select-row");
    expect(row).toBeInTheDocument();
    expect(row).toContainElement(screen.getByLabelText("Common voices"));
    expect(row).toContainElement(screen.getByLabelText("Other voices"));
  });

  it('picking "Default voice" stores "" (not null) and shows Default voice, with no unavailable note', async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    // Starts on Samantha (the default), a common voice.
    expect(common.value).toBe("samantha");
    // Pick "Default voice": the stored value is "" — the explicit
    // browser-default sentinel — not null (null is only the legacy
    // never-set value, and must never be stored again).
    fireEvent.change(common, { target: { value: "" } });
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.voiceURI).toBe("");
    // The dropdowns show the choice: Common on "Default voice",
    // Other on its placeholder — and "" is a real choice, so the
    // "isn't available on this device" note must NOT appear.
    expect(common.value).toBe("");
    expect(other.value).toBe("");
    expect(
      within(other).getByRole("option", {
        name: COMMON_VOICE_PLACEHOLDER_TEXT,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/isn't available on this device/),
    ).not.toBeInTheDocument();
  });

  it("a stored legacy null voice resolves to Samantha on load", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    // An old localStorage row (or account copy) saved when the
    // default voice was null: voiceURI null, pitch 1.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceURI: null, voicePitch: 1 }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    // Samantha is selected — the never-set voice resolved to the
    // default — not "Default voice", and no unavailable note.
    expect(common.value).toBe("samantha");
    expect(
      screen.queryByText(/isn't available on this device/),
    ).not.toBeInTheDocument();
    // The pitch resolved to High with it.
    const pitch = screen.getByLabelText("Pitch") as HTMLSelectElement;
    expect(pitch.value).toBe("1.25");
  });

  it('a stored "" voice shows "Default voice" with no unavailable note', async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceURI: "" }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const common = screen.getByLabelText(
      "Common voices",
    ) as HTMLSelectElement;
    const other = screen.getByLabelText("Other voices") as HTMLSelectElement;
    expect(common.value).toBe("");
    expect(
      within(common).getByRole("option", { name: "Default voice" }),
    ).toBeInTheDocument();
    expect(other.value).toBe("");
    expect(
      within(other).getByRole("option", {
        name: COMMON_VOICE_PLACEHOLDER_TEXT,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/isn't available on this device/),
    ).not.toBeInTheDocument();
  });
});

describe("Text size and Larger text", () => {
  it("disables Small and Medium with an explanatory popover while Larger text is on", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ largerText: true }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    expect(screen.getByRole("radio", { name: "Small" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Medium" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Large" })).not.toBeDisabled();
    const tips = screen.getAllByRole("tooltip");
    expect(tips).toHaveLength(2);
    for (const tip of tips) {
      expect(tip).toHaveTextContent(LARGER_TEXT_POPOVER_TITLE);
      expect(tip).toHaveTextContent(LARGER_TEXT_POPOVER_DETAIL);
      expect(tip).not.toHaveClass("demo-popover-visible");
    }
    // Hover and keyboard focus on the wrapper show the popover.
    const wrapper = tips[0].parentElement!;
    fireEvent.mouseOver(wrapper);
    expect(tips[0]).toHaveClass("demo-popover-visible");
    fireEvent.mouseOut(wrapper);
    expect(tips[0]).not.toHaveClass("demo-popover-visible");
    fireEvent.focus(wrapper);
    expect(tips[0]).toHaveClass("demo-popover-visible");
    // The wrapper is the tab stop — the disabled radio cannot take focus.
    expect(wrapper).toHaveAttribute("tabindex", "0");
  });

  it("leaves Small and Medium enabled with no popover while Larger text is off", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    expect(screen.getByRole("radio", { name: "Small" })).not.toBeDisabled();
    expect(screen.getByRole("radio", { name: "Medium" })).not.toBeDisabled();
    expect(screen.getByRole("radio", { name: "Large" })).not.toBeDisabled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps showing the saved size while Larger text is on", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ largerText: true, fontSize: "small" }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    // The saved size is still the checked one — it applies again
    // as soon as Larger text is turned off — it is just not
    // changeable while Larger text is on. (A disabled radio cannot
    // be activated by pointer or keyboard in a real browser; that
    // is the browser's doing, not this component's, so it is pinned
    // here by the disabled attribute, not by a click.)
    const small = screen.getByRole("radio", { name: "Small" });
    expect(small).toBeChecked();
    expect(small).toBeDisabled();
    expect(document.documentElement.getAttribute("data-larger-text")).toBe(
      "true",
    );
  });

  it("turning Larger text on and off disables and re-enables Small and Medium", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const toggle = screen.getByRole("checkbox", { name: /Larger text/ });
    expect(screen.getByRole("radio", { name: "Small" })).not.toBeDisabled();
    fireEvent.click(toggle);
    expect(screen.getByRole("radio", { name: "Small" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Medium" })).toBeDisabled();
    expect(screen.getAllByRole("tooltip")).toHaveLength(2);
    fireEvent.click(toggle);
    expect(screen.getByRole("radio", { name: "Small" })).not.toBeDisabled();
    expect(screen.getByRole("radio", { name: "Medium" })).not.toBeDisabled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("Settings page fields", () => {
  it("lists the five stylists plus No preference, and saves the chosen one", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const select = screen.getByLabelText(
      "Preferred stylist",
    ) as HTMLSelectElement;
    expect(
      screen.getByRole("option", { name: "No preference" }),
    ).toBeInTheDocument();
    for (const name of [
      "Amelia Brooks",
      "Sofia Reyes",
      "Maya Chen",
      "Jordan Lee",
      "Priya Nair",
    ]) {
      expect(screen.getByRole("option", { name })).toBeInTheDocument();
    }
    fireEvent.change(select, { target: { value: "Maya Chen" } });
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.preferredStylist).toBe("Maya Chen");
    fireEvent.change(select, { target: { value: "" } });
    const cleared = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(cleared.preferredStylist).toBeNull();
  });

  it("starts from the saved stylist, and the notifications checkbox is on by default", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preferredStylist: "Sofia Reyes" }),
    );
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const select = screen.getByLabelText(
      "Preferred stylist",
    ) as HTMLSelectElement;
    expect(select.value).toBe("Sofia Reyes");
    const toggle = screen.getByRole("checkbox", {
      name: /Email me about appointments and offers/,
    });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.emailNotifications).toBe(false);
  });
});

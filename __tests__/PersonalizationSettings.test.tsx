// components/PersonalizationSettings.tsx — the Display settings panel
// on /my-account. Tests the behaviour only: the five theme radios,
// font/size radios and accessibility checkboxes are real inputs with
// labels, a change applies the data attributes to <html> at once and
// persists to localStorage. The account sync (fetch /api/preferences)
// is stubbed to the signed-out shape here — the component must work
// localStorage-only and never error when the route says no.
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import PersonalizationSettings, {
  LARGER_TEXT_POPOVER_DETAIL,
  LARGER_TEXT_POPOVER_TITLE,
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
  it("shows five theme radios, three font pairings, three sizes and three accessibility toggles", async () => {
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    for (const name of ["Plum", "Rose", "Teal", "Forest", "Navy"]) {
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

  it("lists the browser voices and saves the chosen one", async () => {
    mockSpeechSynthesis();
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const select = screen.getByLabelText("Voice") as HTMLSelectElement;
    expect(
      screen.getByRole("option", { name: "Samantha — en-US" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Google US English — en-US" }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "google-us" } });
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
    const select = screen.getByLabelText("Voice") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("groups the voices: the popular five first, the rest underneath", async () => {
    // Browser order is scrambled and the novelty voices sit mixed
    // in with the natural ones — the dropdown must still lead with
    // the five popular voices in curated order.
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
    const select = screen.getByLabelText("Voice") as HTMLSelectElement;
    // "Default voice" is still the first option in the select.
    expect(select.options[0].value).toBe("");
    expect(select.options[0].text).toBe("Default voice");

    const popular = screen.getByRole("group", { name: "Popular voices" });
    expect(
      within(popular)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "Samantha — en-US",
      "Daniel — en-GB",
      "Moira — en-IE",
      "Flo — en-GB",
      "Grandma — en-US",
    ]);

    const all = screen.getByRole("group", { name: "All voices" });
    expect(
      within(all)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "Zarvox — en-US",
      "Bubbles — en-US",
      "Google US English — en-US",
    ]);

    // No voice appears twice across the two groups.
    const values = Array.from(select.options).map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("omits the Popular group when none of the five is installed", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "google-us", name: "Google US English", lang: "en-US" },
    ]);
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    expect(
      screen.queryByRole("group", { name: "Popular voices" }),
    ).not.toBeInTheDocument();
    const all = screen.getByRole("group", { name: "All voices" });
    expect(
      within(all)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Zarvox — en-US", "Google US English — en-US"]);
    expect(
      screen.getByRole("option", { name: "Default voice" }),
    ).toBeInTheDocument();
  });

  it("saves a voice picked from the Popular group", async () => {
    mockSpeechSynthesis([
      { voiceURI: "zarvox", name: "Zarvox", lang: "en-US" },
      { voiceURI: "daniel", name: "Daniel", lang: "en-GB" },
      { voiceURI: "samantha", name: "Samantha", lang: "en-US" },
    ]);
    await act(async () => {
      render(<PersonalizationSettings />);
    });
    const select = screen.getByLabelText("Voice") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "daniel" } });
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    ) as Record<string, unknown>;
    expect(stored.voiceURI).toBe("daniel");
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

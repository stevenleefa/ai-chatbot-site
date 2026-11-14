// components/PersonalizationSettings.tsx — the Display settings panel
// on /my-account. Tests the behaviour only: the five theme radios,
// font/size radios and accessibility checkboxes are real inputs with
// labels, a change applies the data attributes to <html> at once and
// persists to localStorage. The account sync (fetch /api/preferences)
// is stubbed to the signed-out shape here — the component must work
// localStorage-only and never error when the route says no.
import { render, screen, fireEvent, act } from "@testing-library/react";
import PersonalizationSettings from "@/components/PersonalizationSettings";
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

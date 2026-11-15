/**
 * @jest-environment node
 */
// app/api/preferences — the account copy of the display preferences.
// GET returns the defaults when there is no row, and the parsed row
// when there is one; POST upserts the validated preferences. The
// session, Supabase config, rate limiter and JSON reader are
// mocked; the Supabase client is a stub whose select/upsert calls
// are captured, so the tests prove what the route sends to the
// table — in particular the legacy-voice healing (a stored NULL
// voice_uri becomes Samantha, never null again) and the "Default
// voice" sentinel ("").
import { GET, POST } from "@/app/api/preferences/route";

jest.mock("../lib/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("../lib/supabase", () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getServerSupabase: jest.fn(),
}));
jest.mock("../lib/security", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  readCappedJson: async (req: Request) => ({
    body: await req.json().catch(() => null),
    tooLarge: false,
  }),
}));

import { getSession } from "@/lib/auth/session";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

const mockGetSession = getSession as jest.Mock;
const mockConfigured = isSupabaseConfigured as jest.Mock;
const mockGetServerSupabase = getServerSupabase as jest.Mock;

const session = {
  user: { id: "user-1", email: "alex@example.com" },
  profile: {
    id: "user-1",
    email: "alex@example.com",
    role: "customer",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
};

// One full row as the table holds it (snake_case columns), so the
// GET tests prove the route's mapping, not just the parse.
function legacyRow(): Record<string, unknown> {
  return {
    theme: "teal",
    font_pairing: "classic",
    font_size: "medium",
    high_contrast: false,
    reduce_motion: false,
    larger_text: false,
    voice_uri: null,
    voice_rate: 1,
    voice_pitch: 1,
    preferred_stylist: null,
    email_notifications: true,
  };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/preferences", () => {
  const mockMaybeSingle = jest.fn();
  const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const mockUpsert = jest.fn(() => Promise.resolve({ error: null }));
  const mockFrom = jest.fn(() => ({ select: mockSelect, upsert: mockUpsert }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(session);
    mockConfigured.mockReturnValue(true);
    mockGetServerSupabase.mockReturnValue({ from: mockFrom });
  });

  it("401 when signed out", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the defaults (Samantha, Normal, High) when there is no row", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      preferences: Record<string, unknown>;
    };
    expect(body.configured).toBe(true);
    expect(body.preferences.voiceURI).toBe("Samantha");
    expect(body.preferences.voiceRate).toBe(1);
    expect(body.preferences.voicePitch).toBe(1.25);
    expect(body.preferences.theme).toBe("plum");
  });

  it("a legacy row (voice_uri NULL, pitch 1) comes back as Samantha + High", async () => {
    mockMaybeSingle.mockResolvedValue({ data: legacyRow(), error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      preferences: Record<string, unknown>;
    };
    // The rest of the row is kept as saved.
    expect(body.preferences.theme).toBe("teal");
    // The never-set voice resolves to the default, and its
    // old-default pitch (1) resolves to High with it.
    expect(body.preferences.voiceURI).toBe("Samantha");
    expect(body.preferences.voicePitch).toBe(1.25);
  });

  it('an explicit "Default voice" row ("") keeps the browser default and a Normal pitch', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...legacyRow(), voice_uri: "", voice_pitch: 1 },
      error: null,
    });
    const res = await GET();
    const body = (await res.json()) as {
      preferences: Record<string, unknown>;
    };
    expect(body.preferences.voiceURI).toBe("");
    expect(body.preferences.voicePitch).toBe(1);
  });

  it("a saved specific voice and its Normal pitch are kept", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...legacyRow(), voice_uri: "Daniel", voice_pitch: 1 },
      error: null,
    });
    const res = await GET();
    const body = (await res.json()) as {
      preferences: Record<string, unknown>;
    };
    expect(body.preferences.voiceURI).toBe("Daniel");
    expect(body.preferences.voicePitch).toBe(1);
  });
});

describe("POST /api/preferences", () => {
  const mockMaybeSingle = jest.fn();
  const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const mockUpsert = jest.fn(() => Promise.resolve({ error: null }));
  const mockFrom = jest.fn(() => ({ select: mockSelect, upsert: mockUpsert }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(session);
    mockConfigured.mockReturnValue(true);
    mockGetServerSupabase.mockReturnValue({ from: mockFrom });
  });

  it("401 when signed out", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(postRequest({ theme: "teal" }));
    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("heals a legacy null voice on save: upserts Samantha + High, never null", async () => {
    const res = await POST(postRequest({ voiceURI: null, voicePitch: 1 }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const row = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.voice_uri).toBe("Samantha");
    expect(row.voice_pitch).toBe(1.25);
    const body = (await res.json()) as {
      preferences: Record<string, unknown>;
    };
    expect(body.preferences.voiceURI).toBe("Samantha");
  });

  it('stores "" for an explicit "Default voice" choice', async () => {
    const res = await POST(postRequest({ voiceURI: "" }));
    expect(res.status).toBe(200);
    const row = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.voice_uri).toBe("");
  });

  it("saves a new theme id and a specific voice as-is", async () => {
    const res = await POST(
      postRequest({ theme: "yellow", voiceURI: "Daniel", voicePitch: 1 }),
    );
    expect(res.status).toBe(200);
    const row = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.theme).toBe("yellow");
    expect(row.voice_uri).toBe("Daniel");
    expect(row.voice_pitch).toBe(1);
    expect(row.user_id).toBe("user-1");
  });

  it("400 on a non-string voiceURI and on an unknown theme", async () => {
    const badVoice = await POST(postRequest({ voiceURI: 42 }));
    expect(badVoice.status).toBe(400);
    const badTheme = await POST(postRequest({ theme: "magenta" }));
    expect(badTheme.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("500 when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });
    const res = await POST(postRequest({ theme: "purple" }));
    expect(res.status).toBe(500);
  });
});

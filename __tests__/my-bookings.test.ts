/**
 * @jest-environment node
 */
// app/api/my-bookings/[id]/cancel + reschedule — session, ownership
// and validation guards. The session, Supabase config, rate limiter
// and customer-account helpers are mocked: what is under test is
// what the routes refuse and what they pass to the update helpers,
// not the database. In particular the ownership check: a booking
// that is not the customer's answers 404 and the update helper is
// never called.
import { POST as cancelPost } from "@/app/api/my-bookings/[id]/cancel/route";
import { POST as reschedulePost } from "@/app/api/my-bookings/[id]/reschedule/route";

jest.mock("../lib/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("../lib/supabase", () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getServerSupabase: jest.fn(() => ({})),
}));
jest.mock("../lib/security", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  readCappedJson: async (req: Request) => ({
    body: await req.json().catch(() => null),
    tooLarge: false,
  }),
}));
jest.mock("../lib/customer-account", () => ({
  getCustomerBookingById: jest.fn(),
  rescheduleCustomerBooking: jest.fn(),
  cancelCustomerBooking: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { getSession } from "@/lib/auth/session";
import {
  cancelCustomerBooking,
  getCustomerBookingById,
  rescheduleCustomerBooking,
} from "@/lib/customer-account";

const mockGetSession = getSession as jest.Mock;
const mockGetBookingById = getCustomerBookingById as jest.Mock;
const mockReschedule = rescheduleCustomerBooking as jest.Mock;
const mockCancel = cancelCustomerBooking as jest.Mock;

const session = {
  user: { email: "alex@example.com" },
  profile: {
    id: "u1",
    email: "alex@example.com",
    role: "customer",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
};

const bookingRow = {
  id: "1",
  created_at: "2026-11-10T10:00:00Z",
  business: "salon",
  name: "Alex Rivera",
  contact: "alex@example.com",
  service: "Haircut",
  message: null,
  status: "booked",
  appointment_at: null,
};

function postRequest(body: unknown) {
  return new Request("http://localhost:3000/api/my-bookings/1/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// A future Monday–Saturday date, computed from today so the test
// does not go stale: 3 days out, skipping Sundays.
function futureDate(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue(session);
  mockGetBookingById.mockResolvedValue(bookingRow);
  mockReschedule.mockImplementation(async (_s: unknown, _e: string, _id: string, at: string) => ({
    ...bookingRow,
    appointment_at: at,
  }));
  mockCancel.mockResolvedValue({ ...bookingRow, status: "cancelled" });
});

describe("POST /api/my-bookings/[id]/cancel", () => {
  it("returns 401 when not signed in", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await cancelPost(postRequest({}), { params: { id: "1" } });
    expect(res.status).toBe(401);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("returns 404 and never cancels when the booking is not theirs", async () => {
    mockGetBookingById.mockResolvedValue(null);
    const res = await cancelPost(postRequest({}), { params: { id: "99" } });
    expect(res.status).toBe(404);
    expect(mockGetBookingById).toHaveBeenCalledWith(
      expect.anything(),
      "alex@example.com",
      "99"
    );
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("cancels the customer's own booking", async () => {
    const res = await cancelPost(postRequest({}), { params: { id: "1" } });
    expect(res.status).toBe(200);
    expect(mockCancel).toHaveBeenCalledWith(
      expect.anything(),
      "alex@example.com",
      "1"
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.booking.status).toBe("cancelled");
  });
});

describe("POST /api/my-bookings/[id]/reschedule", () => {
  it("returns 401 when not signed in", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await reschedulePost(postRequest({ date: futureDate(), time: "10:00" }), {
      params: { id: "1" },
    });
    expect(res.status).toBe(401);
    expect(mockReschedule).not.toHaveBeenCalled();
  });

  it("returns 404 and never reschedules when the booking is not theirs", async () => {
    mockGetBookingById.mockResolvedValue(null);
    const res = await reschedulePost(postRequest({ date: futureDate(), time: "10:00" }), {
      params: { id: "99" },
    });
    expect(res.status).toBe(404);
    expect(mockReschedule).not.toHaveBeenCalled();
  });

  it("reschedules a future weekday within opening hours", async () => {
    const date = futureDate();
    const res = await reschedulePost(postRequest({ date, time: "10:00" }), {
      params: { id: "1" },
    });
    expect(res.status).toBe(200);
    expect(mockReschedule).toHaveBeenCalledWith(
      expect.anything(),
      "alex@example.com",
      "1",
      `${date}T10:00:00.000Z`
    );
  });

  it("returns 400 for a Sunday, a past date, and a time outside 09:00–18:00", async () => {
    for (const body of [
      { date: "2026-11-15", time: "10:00" }, // a Sunday
      { date: "2020-01-06", time: "10:00" }, // past (a Monday)
      { date: futureDate(), time: "08:00" },
      { date: futureDate(), time: "19:00" },
    ]) {
      const res = await reschedulePost(postRequest(body), {
        params: { id: "1" },
      });
      expect(res.status).toBe(400);
    }
    expect(mockReschedule).not.toHaveBeenCalled();
  });
});

// lib/health.ts — the logic behind /api/health, used by the
// Kubernetes liveness/readiness probes and by the load-balancing
// demo (curl it repeatedly; the `pod` value changes per replica).
// The route handler itself (app/api/health/route.ts) is a thin
// NextResponse wrapper over getHealth(); its HTTP behaviour is
// verified live (curl on a dev server returns 200 + the JSON body).
// No network, no Supabase: getHealth only reads the machine hostname.
import { getHealth } from "@/lib/health";

describe("getHealth", () => {
  it("returns ok:true and a non-empty pod hostname", () => {
    const health = getHealth();
    expect(health.ok).toBe(true);
    expect(typeof health.pod).toBe("string");
    expect(health.pod.length).toBeGreaterThan(0);
  });
});

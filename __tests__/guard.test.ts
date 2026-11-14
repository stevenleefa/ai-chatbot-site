// lib/auth/guard.ts — the pure owner-route gating used by the
// middleware (middleware.ts). No Supabase, no Next.js: just the
// decision table, so it runs in Jest. The cases that matter:
//   - a public path is always allowed, whoever asks;
//   - a signed-out visitor is sent to /login (pages) or gets a 401
//     (API routes);
//   - a signed-in user with no profile row, or an inactive profile,
//     is sent back to /login with account-inactive (or a 401);
//   - a signed-in CUSTOMER is sent to /my-account (pages) or gets a
//     401 (API routes) — a customer session is real, but it is not
//     staff, so it must never open an owner route;
//   - staff and admin are allowed everywhere an owner route goes.
import {
  decideOwnerAccess,
  isOwnerPath,
} from "@/lib/auth/guard";

const staff = { role: "staff" as const, is_active: true };
const admin = { role: "admin" as const, is_active: true };
const customer = { role: "customer" as const, is_active: true };
const inactiveStaff = { role: "staff" as const, is_active: false };

describe("isOwnerPath", () => {
  it("matches every owner prefix and its sub-pages", () => {
    for (const p of [
      "/leads",
      "/leads/abc",
      "/dashboard",
      "/admin",
      "/customers",
      "/customers/123",
      "/appointments",
      "/employees",
      "/employees/123",
      "/orders",
      "/profile",
      "/api/leads",
      "/api/leads/export",
      "/api/leads/status",
    ]) {
      expect(isOwnerPath(p)).toBe(true);
    }
  });

  it("does not match public or customer pages", () => {
    for (const p of [
      "/",
      "/products",
      "/login",
      "/my-account",
      "/my-account/sign-in",
      "/my-account/sign-up",
      "/contact",
      "/deals",
      "/api/lead",
      "/api/chat",
      "/auth/callback",
    ]) {
      expect(isOwnerPath(p)).toBe(false);
    }
  });
});

describe("decideOwnerAccess", () => {
  it("allows any public path, signed in or not", () => {
    expect(
      decideOwnerAccess("/", { hasUser: false, profile: null })
    ).toEqual({ action: "allow" });
    expect(
      decideOwnerAccess("/my-account", { hasUser: true, profile: customer })
    ).toEqual({ action: "allow" });
    expect(
      decideOwnerAccess("/products", { hasUser: true, profile: staff })
    ).toEqual({ action: "allow" });
  });

  it("sends a signed-out visitor to /login (pages) or 401 (API)", () => {
    expect(
      decideOwnerAccess("/dashboard", { hasUser: false, profile: null })
    ).toEqual({ action: "redirect", to: "/login?next=%2Fdashboard" });
    expect(
      decideOwnerAccess("/api/leads", { hasUser: false, profile: null })
    ).toEqual({ action: "unauthorized" });
  });

  it("sends a user with no profile row, or an inactive profile, back to /login", () => {
    expect(
      decideOwnerAccess("/leads", { hasUser: true, profile: null })
    ).toEqual({ action: "redirect", to: "/login?error=account-inactive" });
    expect(
      decideOwnerAccess("/leads", { hasUser: true, profile: inactiveStaff })
    ).toEqual({ action: "redirect", to: "/login?error=account-inactive" });
    expect(
      decideOwnerAccess("/api/leads", { hasUser: true, profile: null })
    ).toEqual({ action: "unauthorized" });
  });

  it("sends a customer to /my-account on owner pages, and 401 on owner API routes", () => {
    for (const p of [
      "/leads",
      "/dashboard",
      "/admin",
      "/customers",
      "/appointments",
      "/employees",
      "/orders",
      "/profile",
    ]) {
      expect(
        decideOwnerAccess(p, { hasUser: true, profile: customer })
      ).toEqual({ action: "redirect", to: "/my-account" });
    }
    expect(
      decideOwnerAccess("/api/leads", { hasUser: true, profile: customer })
    ).toEqual({ action: "unauthorized" });
    expect(
      decideOwnerAccess("/api/leads/export", {
        hasUser: true,
        profile: customer,
      })
    ).toEqual({ action: "unauthorized" });
  });

  it("allows staff and admin on owner pages and API routes", () => {
    for (const profile of [staff, admin]) {
      expect(
        decideOwnerAccess("/dashboard", { hasUser: true, profile })
      ).toEqual({ action: "allow" });
      expect(
        decideOwnerAccess("/api/leads", { hasUser: true, profile })
      ).toEqual({ action: "allow" });
      expect(
        decideOwnerAccess("/admin", { hasUser: true, profile })
      ).toEqual({ action: "allow" });
    }
  });

  // Test Admin Mode (demo mode, see DEMO_MODE.md): the demo cookie
  // lets a signed-OUT visitor browse the owner routes — the pages
  // serve sample data then, never the real tables. It only ever
  // applies without a session: a signed-in user is always judged by
  // their real role, so demo can never upgrade a customer or
  // downgrade staff.
  it("demo mode: a signed-out visitor with the demo cookie reaches owner pages and API routes", () => {
    for (const p of [
      "/leads",
      "/dashboard",
      "/admin",
      "/customers",
      "/appointments",
      "/employees",
      "/orders",
      "/profile",
    ]) {
      expect(
        decideOwnerAccess(p, { hasUser: false, profile: null, demo: true })
      ).toEqual({ action: "allow" });
    }
    expect(
      decideOwnerAccess("/api/leads", {
        hasUser: false,
        profile: null,
        demo: true,
      })
    ).toEqual({ action: "allow" });
    expect(
      decideOwnerAccess("/api/leads/export", {
        hasUser: false,
        profile: null,
        demo: true,
      })
    ).toEqual({ action: "allow" });
  });

  it("demo mode: a signed-in customer is still sent to /my-account, demo cookie or not", () => {
    expect(
      decideOwnerAccess("/dashboard", {
        hasUser: true,
        profile: customer,
        demo: true,
      })
    ).toEqual({ action: "redirect", to: "/my-account" });
    expect(
      decideOwnerAccess("/api/leads", {
        hasUser: true,
        profile: customer,
        demo: true,
      })
    ).toEqual({ action: "unauthorized" });
  });

  it("demo mode: staff and admin are unchanged by the demo cookie", () => {
    for (const profile of [staff, admin]) {
      expect(
        decideOwnerAccess("/dashboard", {
          hasUser: true,
          profile,
          demo: true,
        })
      ).toEqual({ action: "allow" });
    }
  });
});

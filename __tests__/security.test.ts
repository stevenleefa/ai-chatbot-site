// lib/security.ts — safeRedirect + body caps. Pure functions, no
// network. The open-redirect fix these pin is documented in SECURITY.md.
import {
  safeRedirect,
  bodyTooLarge,
  readCappedJson,
  MAX_BODY_BYTES,
} from "@/lib/security";

describe("safeRedirect", () => {
  it("accepts same-origin paths", () => {
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/leads?status=new")).toBe("/leads?status=new");
    expect(safeRedirect("/customers/abc-123")).toBe("/customers/abc-123");
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirect("https://evil.example/phish")).toBe("/dashboard");
    expect(safeRedirect("http://evil.example")).toBe("/dashboard");
    expect(safeRedirect("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeRedirect("//evil.example")).toBe("/dashboard");
    expect(safeRedirect("/\\evil.example")).toBe("/dashboard");
    // URL-encoded "//evil.example" decodes to "//..." and must fail too.
    expect(safeRedirect("%2F%2Fevil.example")).toBe("/dashboard");
  });

  it("falls back on empty, null or undecodable input", () => {
    expect(safeRedirect("")).toBe("/dashboard");
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect("%E0%A4%A")).toBe("/dashboard");
  });

  it("uses the caller's fallback when given one", () => {
    expect(safeRedirect("https://evil.example", "/login")).toBe("/login");
    expect(safeRedirect(null, "/login")).toBe("/login");
  });
});

describe("body caps (32 KB)", () => {
  function reqWithLength(len: number | null, body = ""): Request {
    return {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-length"
            ? len === null
              ? null
              : String(len)
            : null,
      },
      text: async () => body,
    } as unknown as Request;
  }

  it("MAX_BODY_BYTES is 32 KiB", () => {
    expect(MAX_BODY_BYTES).toBe(32 * 1024);
  });

  it("bodyTooLarge: over the cap is too large, at/under is not", () => {
    expect(bodyTooLarge(reqWithLength(MAX_BODY_BYTES + 1))).toBe(true);
    expect(bodyTooLarge(reqWithLength(MAX_BODY_BYTES))).toBe(false);
    expect(bodyTooLarge(reqWithLength(100))).toBe(false);
    // No content-length header (e.g. chunked) — not decided here.
    expect(bodyTooLarge(reqWithLength(null))).toBe(false);
  });

  it("readCappedJson parses a small JSON body", async () => {
    const { body, tooLarge } = await readCappedJson(
      reqWithLength(15, '{"name":"Ada"}')
    );
    expect(tooLarge).toBe(false);
    expect(body).toEqual({ name: "Ada" });
  });

  it("readCappedJson rejects a body over the cap even with no content-length", async () => {
    const big = "x".repeat(MAX_BODY_BYTES + 1);
    const { tooLarge } = await readCappedJson(reqWithLength(null, big));
    expect(tooLarge).toBe(true);
  });

  it("readCappedJson rejects a body over the cap via content-length", async () => {
    const { tooLarge } = await readCappedJson(
      reqWithLength(MAX_BODY_BYTES + 1, "{}")
    );
    expect(tooLarge).toBe(true);
  });

  it("readCappedJson returns an empty object for non-JSON", async () => {
    const { body, tooLarge } = await readCappedJson(
      reqWithLength(7, "notjson")
    );
    expect(tooLarge).toBe(false);
    expect(body).toEqual({});
  });
});

// Shared security helpers. Pure functions only — safe to import from
// client components (e.g. /login) and server code alike. See
// SECURITY.md for the audit, the pen-test and the residual risks.

// A redirect target is safe only when it is a same-origin path: it
// must start with "/" and must not be a protocol-relative URL
// ("//evil.example") or a backslash trick ("/\evil.example"). An
// absolute URL (https://evil.example) fails the check too. Anything
// unsafe falls back to the given page. This closes the open-redirect
// hole /auth/callback and /login used to have via ?next=.
export function safeRedirect(
  target: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!target) return fallback;
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return fallback;
  }
  if (
    decoded.startsWith("/") &&
    !decoded.startsWith("//") &&
    !decoded.startsWith("/\\")
  ) {
    return decoded;
  }
  return fallback;
}

// Simple in-memory fixed-window rate limiter. Per server instance:
// Vercel may run several instances, so this caps what one instance
// sees, not the whole deployment (see SECURITY.md). Good enough for a
// demo to blunt a flood from one IP; a real production site wants a
// shared store (Upstash Redis, or a WAF) instead.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  // Opportunistic cleanup so the map cannot grow without bound.
  // (forEach, not for...of over the Map: this tsconfig has no
  // downlevelIteration — same reason the customers code uses forEach.)
  if (buckets.size > 1000) {
    buckets.forEach((v, k) => {
      if (v.resetAt <= now) buckets.delete(k);
    });
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// The client IP as the app sees it. Behind Vercel, x-forwarded-for is
// set by the platform (first entry = the real client). Locally there
// is no proxy, so it falls back to "unknown" — every local request
// then shares one bucket, which is fine for a dev server.
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// Reject absurd request bodies before parsing them. Route handlers
// have no built-in body limit, so a multi-megabyte JSON body would
// otherwise be parsed and (for /api/lead) offered to the database.
export const MAX_BODY_BYTES = 32 * 1024;

export function bodyTooLarge(req: Request): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false;
  const n = Number(len);
  return Number.isFinite(n) && n > MAX_BODY_BYTES;
}

// Read a JSON request body with a hard byte cap. bodyTooLarge() only
// sees the content-length header, and a chunked request carries none —
// without this, a multi-megabyte chunked body would still be parsed.
// Returns { body } on success, { tooLarge: true } when the raw body
// exceeds MAX_BODY_BYTES, and { body: {} } when the body is not JSON.
export async function readCappedJson(
  req: Request
): Promise<{ body: unknown; tooLarge: boolean }> {
  if (bodyTooLarge(req)) return { body: null, tooLarge: true };
  const raw = await req.text().catch(() => "");
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return { body: null, tooLarge: true };
  }
  try {
    return { body: JSON.parse(raw) as unknown, tooLarge: false };
  } catch {
    return { body: {}, tooLarge: false };
  }
}

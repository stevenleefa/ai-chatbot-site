/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output: `next build` emits a self-contained server in
  // .next/standalone (server.js + pruned node_modules) that the
  // Dockerfile's runner stage copies and runs with plain `node`.
  // No `next start` or full node_modules needed in the final image.
  output: "standalone",
  // Security headers (see SECURITY.md). Applied to every route.
  // No Content-Security-Policy here on purpose: Next.js App Router
  // ships inline scripts for hydration, so a strict CSP would break
  // the site unless every script carried a nonce — that needs the
  // nonce plumbed through middleware and the build, which this demo
  // does not do. The headers below are the safe set.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

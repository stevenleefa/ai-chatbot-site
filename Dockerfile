# Lumen Hair Studio (salon demo) — multi-stage Dockerfile.
#
#   docker build -t lumen-salon:test .
#   docker run --rm -p 3000:3000 lumen-salon:test
#
# The app runs unconfigured without any env vars (leads/chat fall back to
# their no-Supabase behaviour). To run it with the real backend, pass a
# .env.local file:  docker run --rm -p 3000:3000 --env-file .env.local ...
# Never bake secrets into the image — see .dockerignore (.env.local is
# excluded from the build context).
#
# Stages:
#   deps    — install all dependencies (dev deps included: the build runs
#             TypeScript type-checking, so `typescript` must be present)
#   builder — `next build` with output: 'standalone' (see next.config.js)
#   runner  — minimal production image: standalone server + static assets,
#             runs as a non-root user, no build tools, no source, no tests

# ---------- deps ----------
FROM node:20-alpine AS deps
# libc6-compat is needed by some native Next.js/SWC binaries on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Telemetry off: this is a demo image, and a build should not phone home.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Non-root user (Next.js docs convention: nextjs:nodejs, uid/gid 1001).
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output: .next/standalone holds server.js + pruned node_modules.
# .next/static and public/ are NOT inside standalone — copy them in.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

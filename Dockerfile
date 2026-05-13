# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# ICONIA-ADMIN — production container image (ECS Fargate)
#
# Next.js 14 (app router) in "standalone" output mode (see next.config.mjs:
# `output: "standalone"`). The standalone build emits a minimal self-contained
# server at .next/standalone/server.js plus the static assets.
#
# Stages:
#   1. deps    — full `npm ci` (build needs typescript / @types / eslint-config-next)
#   2. builder — `next build` → .next/standalone + .next/static
#   3. runner  — copy only the standalone output, run as non-root user `nextjs`
#
# Service listens on $PORT (default 3000). No /health route — health checks hit
# `/login` (allowed by middleware) or `/`.
# -----------------------------------------------------------------------------

# ---- deps stage -------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder stage ----------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner stage -----------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Non-root runtime user.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone server bundle (includes a pruned node_modules).
COPY --from=builder /app/.next/standalone ./
# Static assets are not included in the standalone bundle — copy them next to it.
COPY --from=builder /app/.next/static ./.next/static
# NOTE: no admin/public/ directory exists in this repo, so no `public/` COPY.
#       If a public/ dir is added later, add:
#       COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

# Container-level health probe — admin has no /health route; /login is public.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

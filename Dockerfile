# syntax=docker/dockerfile:1

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm via corepack
RUN corepack enable

# Copy only files needed for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (skip devDependencies)
RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 2: Builder ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Generate Prisma client
RUN pnpm db:generate

# Build the application
RUN pnpm build

# ── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs

# Set ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["pnpm", "start"]

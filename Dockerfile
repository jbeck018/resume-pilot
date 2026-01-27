# =============================================================================
# HowlerHire - Production Dockerfile
# =============================================================================
# Multi-stage build for optimized production image
#
# Build: docker build -t howlerhire:latest .
# Run:   docker run -p 3000:3000 --env-file .env howlerhire:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
# Install all dependencies in a separate stage for better caching
FROM node:20-alpine AS deps

# Install build dependencies for native modules (if any)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
# Build the SvelteKit application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Install the Node adapter for Docker builds
# The Cloudflare adapter is for Cloudflare Workers, not Docker
RUN npm install @sveltejs/adapter-node@latest

# Use Docker-specific SvelteKit config with Node adapter
RUN cp svelte.config.docker.js svelte.config.js

# Set environment for build
ENV NODE_ENV=production

# Build the application
# Note: SvelteKit with node adapter outputs to /build
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 3: Production Runner
# -----------------------------------------------------------------------------
# Minimal production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install security updates and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init && \
    apk upgrade --no-cache

# Create non-root user for security
# Using numeric IDs for better compatibility across systems
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy built application from builder stage
# SvelteKit node adapter outputs to /build by default
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./package.json

# Switch to non-root user
USER sveltekit

# Expose the application port
EXPOSE 3000

# Health check to verify the application is running
# Checks every 30s, times out after 10s, starts checking after 40s
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly (prevents zombie processes)
# Run the SvelteKit application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build"]

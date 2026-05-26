# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- Production Dependencies ----
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy prisma schema for runtime migrate, reuse generated client from builder
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ---- Production Stage ----
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy production node_modules (includes prisma CLI + client)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Entrypoint script
COPY --chown=node:node docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Fix permissions for node user (prisma needs write access to engines dir)
RUN chown -R node:node /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

EXPOSE 3001

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]

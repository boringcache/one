# syntax=docker/dockerfile:1

# Multi-stage production image for Next.js (Node 20 Alpine)
# Build:
#   docker build -t nextjs_app ./actions/action/examples/nextjs_app
# Run:
#   docker run -p 3000:3000 --name nextjs_app nextjs_app

ARG NODE_VERSION=20

# 1) Dependencies stage
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# Enable Corepack-managed Yarn to respect the existing yarn.lock
RUN corepack enable

# Install dependencies (uses yarn.lock to produce reproducible installs)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# 2) Build stage
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
RUN corepack enable

# Reuse previously installed deps
COPY --from=deps /app/node_modules ./node_modules
# Copy the application source
COPY . .

# Disable telemetry in CI/containers and build the app
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# 3) Runtime stage
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Run as non-root for security
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Bring only what we need to run the server
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

USER nextjs
EXPOSE 3000
CMD ["yarn", "start", "-p", "3000"]
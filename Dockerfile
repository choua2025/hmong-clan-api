# syntax=docker/dockerfile:1

# Container image for the Vang Clan (Xeem Vaj) Association API.
#
# Targets:
#   dev   — tsx watch, source bind-mounted by docker-compose
#   prod  — compiled dist/, production deps only, non-root
#
# `prod` MUST stay the final stage. Render has no blueprint field for choosing
# a build target, so it builds whatever stage comes last; adding a stage below
# prod would silently ship that one to production instead.
#
# Debian slim rather than Alpine on purpose: Prisma's query engine links
# against OpenSSL, and the musl builds are a recurring source of
# "Unable to require libquery_engine" failures. The size cost is worth it.

ARG NODE_VERSION=22

# ── base ────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── deps ────────────────────────────────────────────────────────
# Full install (dev + prod). npm's postinstall hook runs `prisma generate`
# here, so the Prisma client is generated for LINUX inside the image rather
# than copied from the host.
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
# prisma.config.ts resolves env('DATABASE_URL') the moment the config loads,
# so `prisma generate` needs the variable set even though it never opens a
# connection. Passed inline so the placeholder is NOT baked into the image.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm ci --include=dev

# ── build ───────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── dev ─────────────────────────────────────────────────────────
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ── prod ────────────────────────────────────────────────────────
FROM base AS prod
ENV NODE_ENV=production
# Take ownership as the runtime user BEFORE installing, so the whole tree is
# node-owned. Render's pre-deploy step runs `prisma migrate deploy` in this
# image, and the CLI writes into node_modules/@prisma/engines — which fails
# with "Can't write to /app/node_modules/@prisma/engines" against a root-owned
# tree. Doing it up front also avoids an expensive `chown -R` layer.
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
# Install scripts are deliberately NOT skipped: @prisma/engines downloads its
# binaries in a postinstall (without them, migrations fail at deploy time),
# and the root postinstall runs `prisma generate` for Linux. The `prisma` CLI
# is a peer dependency of @prisma/client, so it is present even here in a
# production-only install — that is what runs the migrations.
# DATABASE_URL is inline: needed to load prisma.config.ts, never connected to,
# and not baked into the image.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"]

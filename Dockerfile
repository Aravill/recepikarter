# syntax=docker/dockerfile:1

# better-sqlite3 is a native addon: compile it against the same base image
# used at runtime rather than relying on a prebuilt binary being available
# for the target platform (home servers are as likely to be arm64 as amd64).
ARG NODE_IMAGE=node:24-bookworm-slim

# ---- build: install full deps, build the Nuxt app -------------------------
FROM ${NODE_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- prod-deps: install only what .output/server actually needs at runtime
# (Nitro writes a minimal package.json listing just the externalized deps —
# far fewer than the full project's node_modules, e.g. no Vite/Nuxt CLI).
FROM ${NODE_IMAGE} AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY --from=build /app/.output/server/package.json ./package.json
RUN npm install --omit=dev

# ---- runtime: clean image, no compilers, no dev tooling -------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.output ./
COPY --from=prod-deps /app/server/node_modules ./server/node_modules

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server/index.mjs"]

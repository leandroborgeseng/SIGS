# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --workspaces --include-workspace-root

FROM deps AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=https://sigs-production.up.railway.app/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run db:generate --workspace=@sigs/api \
  && npm run build --workspace=@sigs/api \
  && npm run build --workspace=@sigs/web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV API_PORT=3001
ENV DATABASE_URL="file:/data/sigs.db"
ENV CORS_ORIGIN="*"
# JWT_SECRET deve vir das Variables do Railway/Coolify (não embutir no Dockerfile)

RUN apt-get update && apt-get install -y --no-install-recommends tini openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data

# npm workspaces hoist deps em /app/node_modules (não há apps/*/node_modules)
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.ts ./apps/web/
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Railway: não use VOLUME no Dockerfile — monte Volume do painel em /data.
EXPOSE 3000 3001
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]

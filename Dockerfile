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
# nest deve emitir apps/api/dist/main.js (não dist/api/src/main.js). Falha a imagem se faltar.
RUN npm run db:generate --workspace=@sigs/api \
  && npm run build --workspace=@sigs/api \
  && if [ ! -f apps/api/dist/main.js ] || [ ! -f apps/api/dist/worker.main.js ]; then \
       echo "FATAL: nest não emitiu apps/api/dist/main.js"; \
       find apps/api/dist -name 'main.js' -o -name 'worker.main.js' 2>/dev/null || true; \
       ls -la apps/api/dist 2>/dev/null || true; \
       exit 1; \
     fi \
  && npm run build --workspace=@sigs/web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV API_PORT=3001
ENV PROCESS_ROLE=all
ENV CORS_ORIGIN="*"
# JWT_SECRET / DATABASE_URL / REDIS_URL / S3_* via painel (Coolify/Railway)

RUN apt-get update && apt-get install -y --no-install-recommends tini openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data /app/apps/api/tmp/storage

# npm workspaces hoist deps em /app/node_modules (não há apps/*/node_modules)
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
# Snapshot CNES (Franca) — sync offline em produção (cwd API = /app/apps/api → ../../data/cnes)
COPY --from=build /app/data/cnes ./data/cnes
RUN if [ ! -f data/cnes/franca-3516200.json ]; then \
      echo "FATAL: snapshot CNES ausente (data/cnes/franca-3516200.json)"; \
      ls -la data/cnes 2>/dev/null || true; \
      exit 1; \
    fi \
  && mkdir -p apps/api/dist/cnes/snapshots \
  && cp data/cnes/*.json apps/api/dist/cnes/snapshots/
RUN if [ ! -f apps/api/dist/main.js ]; then \
      echo "FATAL: apps/api/dist/main.js ausente no estágio runner"; \
      find apps/api/dist -name 'main.js' 2>/dev/null || true; \
      exit 1; \
    fi
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.js ./apps/web/
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/public-proxy.mjs /public-proxy.mjs
RUN chmod +x /entrypoint.sh

# Railway: não use VOLUME no Dockerfile — monte Volume do painel em /data.
# PROCESS_ROLE=all: PORT=3000 public-proxy (stream /api → :3001; UI → Next :3002).
COPY docker/healthcheck.mjs /healthcheck.mjs
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD ["node", "/healthcheck.mjs"]
EXPOSE 3000 3001 3002
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]

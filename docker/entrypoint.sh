#!/bin/sh
set -eu

# Railway injeta PORT na porta pública do domínio.
# Web (Next) escuta em PORT; API (Nest) fica interna em API_PORT.
export DATABASE_URL="${DATABASE_URL:-file:/data/sigs.db}"
export CORS_ORIGIN="${CORS_ORIGIN:-*}"
export JWT_SECRET="${JWT_SECRET:-change-me-in-production}"

PUBLIC_PORT="${PORT:-3000}"
API_PORT="${API_PORT:-3001}"

mkdir -p "$(dirname "${DATABASE_URL#file:}")" 2>/dev/null || true
mkdir -p /data

cd /app/apps/api
PORT="$API_PORT" npx prisma db push --skip-generate
PORT="$API_PORT" node dist/main.js &
API_PID=$!

# dá tempo da API abrir a porta interna antes do Next
sleep 3

cd /app/apps/web
npx next start --hostname 0.0.0.0 --port "$PUBLIC_PORT" &
WEB_PID=$!

echo "SIGS Web :${PUBLIC_PORT} · API interna :${API_PORT}"

term() {
  kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap term INT TERM

wait -n "$API_PID" "$WEB_PID"
term
exit 1

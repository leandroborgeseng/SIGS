#!/bin/sh
set -eu

export DATABASE_URL="${DATABASE_URL:-file:/data/sigs.db}"
export PORT="${PORT:-3001}"
export WEB_PORT="${WEB_PORT:-3000}"
export CORS_ORIGIN="${CORS_ORIGIN:-*}"
export JWT_SECRET="${JWT_SECRET:-change-me-in-production}"

cd /app/apps/api
npx prisma db push --skip-generate
node dist/main.js &
API_PID=$!

cd /app/apps/web
npx next start --port "$WEB_PORT" &
WEB_PID=$!

term() {
  kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap term INT TERM

wait -n "$API_PID" "$WEB_PID"
term
exit 1

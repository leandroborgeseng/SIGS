#!/usr/bin/env bash
# Sobe SIGS focado no Lote LEDI FAO (faturamento odonto).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/tools/node/bin:$PATH"
cd "$ROOT"

echo "==> Prisma db push"
npm run db:push --workspace=@sigs/api

echo "==> Build API"
npm run build --workspace=@sigs/api

mkdir -p /tmp
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

echo "==> API :3001"
(
  cd apps/api
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3000}"
  exec node dist/main.js
) > /tmp/sigs-api.log 2>&1 &
echo $! > /tmp/sigs-api.pid

echo "==> Web :3000"
npm run dev:web > /tmp/sigs-web.log 2>&1 &
echo $! > /tmp/sigs-web.pid

for i in $(seq 1 40); do
  a=$(curl -s --max-time 1 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health || true)
  w=$(curl -s --max-time 1 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login || true)
  if [[ "$a" == "200" && "$w" == "200" ]]; then
    echo ""
    echo "SIGS pronto"
    echo "  UI:    http://localhost:3000/odonto/lote"
    echo "  API:   http://localhost:3001/api"
    echo "  Login: admin@sigs.local / admin123"
    echo "  Logs:  /tmp/sigs-api.log  /tmp/sigs-web.log"
    exit 0
  fi
  sleep 1
done

echo "Falha ao subir — veja /tmp/sigs-api.log e /tmp/sigs-web.log" >&2
exit 1

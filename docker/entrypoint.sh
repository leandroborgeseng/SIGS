#!/bin/bash
set -eu

# Railway: PORT = porta pública do domínio (Target port).
# Nest (API) fica em API_PORT (interna). Next escuta em PORT.

export CORS_ORIGIN="${CORS_ORIGIN:-*}"
export JWT_SECRET="${JWT_SECRET:-change-me-in-production}"

PUBLIC_PORT="${PORT:-3000}"
API_PORT="${API_PORT:-3001}"

mkdir -p /data /tmp

DB_PATH="${DATABASE_URL:-file:/data/sigs.db}"
if [[ "$DB_PATH" == file:* ]]; then
  FILE_PATH="${DB_PATH#file:}"
  DB_DIR="$(dirname "$FILE_PATH")"
  if ! mkdir -p "$DB_DIR" 2>/dev/null || ! touch "$DB_DIR/.write_test" 2>/dev/null; then
    echo "WARN: $DB_DIR não gravável — usando /tmp/sigs.db"
    DB_PATH="file:/tmp/sigs.db"
  else
    rm -f "$DB_DIR/.write_test"
  fi
fi
export DATABASE_URL="$DB_PATH"

echo "SIGS boot · WEB :${PUBLIC_PORT} · API :${API_PORT} · DB ${DATABASE_URL}"

cd /app/apps/api
if ! PORT="$API_PORT" npx prisma db push --skip-generate; then
  echo "ERROR: prisma db push falhou"
  exit 1
fi

PORT="$API_PORT" node dist/main.js &
API_PID=$!

sleep 2
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "ERROR: API não iniciou"
  exit 1
fi

cd /app/apps/web
npx next start --hostname 0.0.0.0 --port "$PUBLIC_PORT" &
WEB_PID=$!

sleep 2
if ! kill -0 "$WEB_PID" 2>/dev/null; then
  echo "ERROR: Web não iniciou"
  kill -TERM "$API_PID" 2>/dev/null || true
  exit 1
fi

echo "SIGS online · http://0.0.0.0:${PUBLIC_PORT} (API interna :${API_PORT})"

term() {
  echo "SIGS shutdown"
  kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap term INT TERM

# Mantém o container vivo enquanto os dois processos rodarem (sem wait -n: incompatível com dash)
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 2
done

echo "ERROR: processo encerrou (API ou Web)"
term
exit 1

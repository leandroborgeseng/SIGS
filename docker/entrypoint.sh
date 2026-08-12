#!/bin/bash
set -eu

# PROCESS_ROLE: api | worker | web | all (legado single-container)
ROLE="${PROCESS_ROLE:-all}"

export CORS_ORIGIN="${CORS_ORIGIN:-*}"
export JWT_SECRET="${JWT_SECRET:-change-me-in-production}"

mkdir -p /data /tmp /app/apps/api/tmp/storage
# Volume Railway em /data → storage local sob /data/storage
if [[ -z "${STORAGE_LOCAL_PATH:-}" && -d /data ]]; then
  export STORAGE_LOCAL_PATH=/data/storage
  mkdir -p "$STORAGE_LOCAL_PATH"
fi

echo "SIGS boot · role=${ROLE} · DB=${DATABASE_URL:-unset}"

migrate_db() {
  cd /app/apps/api
  if ! npx prisma db push --skip-generate; then
    echo "ERROR: prisma db push falhou"
    exit 1
  fi
}

start_api() {
  cd /app/apps/api
  migrate_db
  local port="${PORT:-3001}"
  echo "Starting API :${port}"
  exec node dist/main.js
}

start_worker() {
  cd /app/apps/api
  # Worker assume schema já migrado pela API; tenta push idempotente.
  npx prisma db push --skip-generate || true
  if [[ -z "${REDIS_URL:-}" ]]; then
    echo "ERROR: REDIS_URL obrigatório para PROCESS_ROLE=worker"
    exit 1
  fi
  echo "Starting worker"
  exec node dist/worker.main.js
}

start_web() {
  local port="${PORT:-3000}"
  cd /app/apps/web
  echo "Starting Web :${port}"
  exec npx next start --hostname 0.0.0.0 --port "$port"
}

start_all() {
  # Compat Railway single-container (API + Web no mesmo processo supervisor).
  PUBLIC_PORT="${PORT:-3000}"
  API_PORT="${API_PORT:-3001}"

  cd /app/apps/api
  migrate_db

  PORT="$API_PORT" node dist/main.js &
  API_PID=$!
  sleep 2
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "ERROR: API não iniciou"
    exit 1
  fi

  if [[ -n "${REDIS_URL:-}" ]]; then
    node dist/worker.main.js &
    WORKER_PID=$!
  else
    WORKER_PID=""
  fi

  cd /app/apps/web
  npx next start --hostname 0.0.0.0 --port "$PUBLIC_PORT" &
  WEB_PID=$!
  sleep 2
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "ERROR: Web não iniciou"
    kill -TERM "$API_PID" ${WORKER_PID:+$WORKER_PID} 2>/dev/null || true
    exit 1
  fi

  echo "SIGS online · web :${PUBLIC_PORT} · api :${API_PORT}"

  term() {
    echo "SIGS shutdown"
    kill -TERM "$API_PID" "$WEB_PID" ${WORKER_PID:+$WORKER_PID} 2>/dev/null || true
    wait "$API_PID" "$WEB_PID" ${WORKER_PID:+$WORKER_PID} 2>/dev/null || true
  }
  trap term INT TERM

  while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
    sleep 2
  done
  echo "ERROR: processo encerrou"
  term
  exit 1
}

case "$ROLE" in
  api) start_api ;;
  worker) start_worker ;;
  web) start_web ;;
  all) start_all ;;
  *)
    echo "PROCESS_ROLE inválido: $ROLE (use api|worker|web|all)"
    exit 1
    ;;
esac

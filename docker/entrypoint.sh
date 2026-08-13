#!/bin/bash
set -eu

# PROCESS_ROLE: api | worker | web | all (legado single-container)
ROLE="${PROCESS_ROLE:-all}"

export CORS_ORIGIN="${CORS_ORIGIN:-*}"

mkdir -p /data /tmp /app/apps/api/tmp/storage
# Volume Railway em /data → storage local sob /data/storage
if [[ -z "${STORAGE_LOCAL_PATH:-}" && -d /data ]]; then
  export STORAGE_LOCAL_PATH=/data/storage
  mkdir -p "$STORAGE_LOCAL_PATH"
fi

redact_db() {
  local url="${DATABASE_URL:-}"
  if [[ -z "$url" ]]; then
    echo "unset"
    return
  fi
  # postgresql://user:pass@host:5432/db?x → host:5432/db
  echo "$url" | sed -E 's#^[a-zA-Z0-9+.-]+://[^@]+@##; s#\?.*##'
}

require_runtime_env() {
  local fail=0
  echo "SIGS entrypoint · role=${ROLE} · NODE_ENV=${NODE_ENV:-unset} · DB=$(redact_db) · redis=${REDIS_URL:+set}${REDIS_URL:-absent}"

  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL ausente."
    echo "  Railway: Variables → Add Reference → Postgres → DATABASE_URL"
    echo "  Não use file:... em produção."
    fail=1
  elif [[ "${DATABASE_URL}" == file:* ]]; then
    echo "ERROR: DATABASE_URL=file:... não é suportado no deploy. Use PostgreSQL."
    fail=1
  fi

  if [[ "${NODE_ENV:-}" == "production" ]]; then
    if [[ -z "${JWT_SECRET:-}" ]]; then
      echo "ERROR: JWT_SECRET ausente (obrigatório em production)."
      fail=1
    elif [[ "${#JWT_SECRET}" -lt 16 ]] \
      || [[ "${JWT_SECRET}" == "change-me-in-production" ]] \
      || [[ "${JWT_SECRET}" == "sigs-dev-secret-change-me" ]] \
      || [[ "${JWT_SECRET}" == "troque-em-producao" ]] \
      || [[ "${JWT_SECRET}" == "dev-change-me" ]] \
      || [[ "${JWT_SECRET}" == "troque-por-uma-string-longa-aleatoria-32chars" ]]; then
      echo "ERROR: JWT_SECRET fraco/placeholder. Defina string aleatória ≥32 chars."
      fail=1
    fi
  else
    export JWT_SECRET="${JWT_SECRET:-sigs-dev-secret-change-me}"
    echo "WARN: JWT_SECRET default de dev (NODE_ENV!=production)."
  fi

  if [[ "$ROLE" == "worker" && -z "${REDIS_URL:-}" ]]; then
    echo "ERROR: REDIS_URL obrigatório para PROCESS_ROLE=worker."
    echo "  Sem Redis: use PROCESS_ROLE=all|api (jobs inline)."
    fail=1
  fi

  if [[ -z "${REDIS_URL:-}" && "$ROLE" != "worker" && "$ROLE" != "web" ]]; then
    echo "INFO: REDIS_URL ausente — fila BullMQ inline no processo da API (ok p/ 1º deploy)."
  fi

  if [[ "$ROLE" == "all" || "$ROLE" == "web" ]]; then
    if [[ -z "${API_INTERNAL_URL:-}" ]]; then
      export API_INTERNAL_URL="http://127.0.0.1:${API_PORT:-3001}"
      echo "INFO: API_INTERNAL_URL default → ${API_INTERNAL_URL} (proxy Next /api)"
    fi
  fi

  if [[ "$fail" -ne 0 ]]; then
    echo "SIGS entrypoint abortado — corrija Variables e redeploy."
    exit 1
  fi
}

require_runtime_env

prep_appointment_id_unique() {
  # Deduplica appointment_id antes do unique (MVP agenda odonto).
  # No-op se tabela/coluna ainda não existir — db push cria o schema.
  local sql="prisma/sql/prep-appointment-id-unique.sql"
  if [[ ! -f "$sql" ]]; then
    echo "WARN: $sql ausente — pulando prep de unique appointment_id"
    return 0
  fi
  echo "SIGS migrate · prep unique appointment_id (dedupe)…"
  if npx prisma db execute --file "$sql" --schema prisma/schema.prisma; then
    echo "SIGS migrate · prep ok"
  else
    echo "INFO: prep SQL não aplicado (schema ainda inexistente ou DB sem coluna) — db push segue"
  fi
}

migrate_db() {
  cd /app/apps/api
  local log
  log="$(mktemp)"

  prep_appointment_id_unique

  echo "SIGS migrate · prisma db push…"
  set +e
  npx prisma db push --skip-generate >"$log" 2>&1
  local rc=$?
  set -e
  cat "$log"

  if [[ "$rc" -eq 0 ]]; then
    rm -f "$log"
    echo "SIGS migrate · ok"
    return 0
  fi

  if grep -qiE 'accept-data-loss|data loss when applying' "$log"; then
    echo "WARN: prisma exigiu --accept-data-loss (ex.: unique em dental_encounters.appointment_id)."
    echo "      Não é falha de DATABASE_URL. Deduplicando e repetindo com flag segura p/ este caso."
    echo "      Risco: duplicatas reais de appointment_id são nullificadas (fica o mais recente)."
    echo "      NULLs múltiplos em PG são OK sob UNIQUE."
    prep_appointment_id_unique
    set +e
    npx prisma db push --skip-generate --accept-data-loss >"$log" 2>&1
    rc=$?
    set -e
    cat "$log"
    rm -f "$log"
    if [[ "$rc" -eq 0 ]]; then
      echo "SIGS migrate · ok (após prep + --accept-data-loss)"
      return 0
    fi
    echo "ERROR: prisma db push falhou mesmo com --accept-data-loss."
    echo "  Revise o log Prisma acima (constraint/FK/tipo), não assuma DATABASE_URL."
    return 1
  fi

  rm -f "$log"
  echo "ERROR: prisma db push falhou."
  echo "  Causas comuns: Postgres inacessível, DATABASE_URL inválida/rede, ou schema incompatível."
  echo "  Se a mensagem falar em data loss / --accept-data-loss, trate como schema — não como URL."
  return 1
}

start_api() {
  cd /app/apps/api
  if ! migrate_db; then
    exit 1
  fi
  local port="${PORT:-3001}"
  echo "Starting API :${port} (health → /api/health)"
  exec node dist/main.js
}

start_worker() {
  cd /app/apps/api
  # Worker assume schema já migrado pela API; tenta push idempotente (soft).
  migrate_db || echo "WARN: migrate no worker falhou — API deve ter migrado"
  echo "Starting worker (REDIS_URL set)"
  exec node dist/worker.main.js
}

start_web() {
  local port="${PORT:-3000}"
  cd /app/apps/web
  echo "Starting Web :${port} · proxy API_INTERNAL_URL=${API_INTERNAL_URL:-unset}"
  exec npx next start --hostname 0.0.0.0 --port "$port"
}

start_all() {
  # Compat Railway single-container (API + Web no mesmo processo supervisor).
  PUBLIC_PORT="${PORT:-3000}"
  API_PORT="${API_PORT:-3001}"
  export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:${API_PORT}}"

  cd /app/apps/api
  if ! migrate_db; then
    exit 1
  fi

  PORT="$API_PORT" node dist/main.js &
  API_PID=$!
  sleep 3
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "ERROR: API não iniciou (veja logs acima — env / Prisma / porta)."
    exit 1
  fi

  if [[ -n "${REDIS_URL:-}" ]]; then
    node dist/worker.main.js &
    WORKER_PID=$!
    echo "INFO: worker separado iniciado (REDIS_URL)"
  else
    WORKER_PID=""
    echo "INFO: sem worker separado — jobs inline na API"
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
  echo "  health (público): http://0.0.0.0:${PUBLIC_PORT}/api/health"
  echo "  ready  (público): http://0.0.0.0:${PUBLIC_PORT}/api/ready"
  echo "  health (API):     http://127.0.0.1:${API_PORT}/api/health"

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

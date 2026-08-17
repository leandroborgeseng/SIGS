#!/usr/bin/env bash
# Smoke de regressão — CNES municipal · PF · auditoria faturamento · gate LEDI CDS.
# Dados: fixtures sintéticas / snapshots públicos Franca (sem PHI de pacientes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$ROOT/tools/node-home/bin"
if [[ -x "$NODE_BIN/node" ]]; then
  export PATH="$NODE_BIN:$PATH"
fi

cd "$ROOT/apps/api"

PATTERN='cnes\.filter|cnes-audit|cnes\.professionals|cnes\.loader|cnes\.parser|cnes-teams|team-type-catalog|faturamento-audit|ledi-ficha-tipo|ledi-cds-lote|ledi-cds-extra'

echo "==> Smoke regressão: ${PATTERN}"
npx jest --config jest.config.js --testPathPattern="${PATTERN}" --ci --colors=false

echo "==> OK — CNES/PF/audit/LEDI gate"

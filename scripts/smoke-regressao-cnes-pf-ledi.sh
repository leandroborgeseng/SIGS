#!/usr/bin/env bash
# Smoke de regressão — CNES/PF · auditoria · LEDI · SIGTAP · P×2 · deep-link · Previne.
# Dados: fixtures sintéticas / snapshots públicos Franca (sem PHI de pacientes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$ROOT/tools/node-home/bin"
if [[ -x "$NODE_BIN/node" ]]; then
  export PATH="$NODE_BIN:$PATH"
fi

cd "$ROOT/apps/api"

PATTERN='cnes\.filter|cnes-audit|cnes\.professionals|cnes\.loader|cnes\.parser|cnes-teams|team-type-catalog|faturamento-audit|ledi-ficha-tipo|ledi-cds-lote|ledi-cds-extra|ledi-fai-proc|ledi-cidadao-master|ledi-vinculo-completude|ledi-fao-previne|sigtap\.seed|local-file\.loader|ms-procedimento'

echo "==> Smoke regressão ampliado: ${PATTERN}"
npx jest --config jest.config.js --testPathPattern="${PATTERN}" --ci --colors=false

echo "==> OK — CNES/PF/audit/LEDI/SIGTAP/P×2/NT30/Previne/deep-link"

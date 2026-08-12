#!/usr/bin/env bash
# Análise inicial do e-SUS APS → inventário + classificação + mapas.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> SIGS / sus_intelligence — analyze-esus"
echo "    root: $ROOT"

if [[ ! -d "$ROOT/e-SUS" ]]; then
  echo "ERRO: pasta e-SUS/ não encontrada." >&2
  exit 1
fi

JAR_ARG=()
if [[ $# -gt 0 ]]; then
  JAR_ARG=(--jar "$1")
fi

python3 -m sus_intelligence esus analyze "${JAR_ARG[@]}"

echo
echo "==> Saídas principais:"
echo "    STATUS.md"
echo "    01-manifest.json … 10-gaps.md (raiz)"
echo "    data/esus/<versão>/reports/"
echo "    cache/esus/<sha256>/"

#!/usr/bin/env bash
# Decompilação seletiva de JARs P0 do e-SUS com CFR.
# Uso:
#   ./scripts/decompile-esus.sh                 # decompila conjunto P0 padrão
#   ./scripts/decompile-esus.sh pec.business.impl-5.5.24.jar
#   ./scripts/decompile-esus.sh --list
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JAVA_HOME="${JAVA_HOME:-$ROOT/tools/java-home}"
JAVA_BIN="$JAVA_HOME/bin/java"
CFR="$ROOT/tools/cfr-0.152.jar"
VERSION="${ESUS_VERSION:-5.5.24}"
SHA="${ESUS_SHA:-69e2ccd9e17f40fe260ae10ceb641b8b69be84c3e48b60e42264c086008f9b52}"
CACHE="$ROOT/cache/esus/$SHA"
PEC="$CACHE/extracted/pec-bundle.jar"
MIG="$CACHE/extracted/migrador.jar"
OUT_RAW="$ROOT/data/esus/$VERSION/decompiled/raw"
LIBS_DIR="$CACHE/extracted/libs"

# Conjunto inicial prioritário (domínio + LEDI + schema)
DEFAULT_JARS=(
  "model-5.5.24.jar"
  "cds.common.api-5.5.24.jar"
  "cds.service.api-5.5.24.jar"
  "cds.service.impl-5.5.24.jar"
  "pec.common.api-5.5.24.jar"
  "pec.business.impl-5.5.24.jar"
  "pec.persistence-5.5.24.jar"
  "core.validation-5.5.24.jar"
  "validation-1.4.15.jar"
  "pec-ledi-thrift-6.2.10.jar"
  "database-5.5.24.jar"
)

die() { echo "ERRO: $*" >&2; exit 1; }

[[ -x "$JAVA_BIN" ]] || die "Java não encontrado em $JAVA_BIN. Rode a instalação em tools/."
[[ -f "$CFR" ]] || die "CFR não encontrado em $CFR"
[[ -f "$PEC" ]] || die "pec-bundle.jar ausente. Rode ./scripts/analyze-esus.sh primeiro."
[[ -f "$MIG" ]] || die "migrador.jar ausente. Rode ./scripts/analyze-esus.sh primeiro."

mkdir -p "$LIBS_DIR" "$OUT_RAW"

extract_nested() {
  local jar_name="$1"
  local dest="$LIBS_DIR/$jar_name"
  if [[ -f "$dest" ]]; then
    return 0
  fi
  if unzip -l "$PEC" "BOOT-INF/lib/$jar_name" >/dev/null 2>&1; then
    unzip -jo "$PEC" "BOOT-INF/lib/$jar_name" -d "$LIBS_DIR" >/dev/null
  elif unzip -l "$MIG" "BOOT-INF/lib/$jar_name" >/dev/null 2>&1; then
    unzip -jo "$MIG" "BOOT-INF/lib/$jar_name" -d "$LIBS_DIR" >/dev/null
  else
    die "JAR não encontrado em pec-bundle/migrador: $jar_name"
  fi
}

decompile_one() {
  local jar_name="$1"
  local stem="${jar_name%.jar}"
  local dest="$OUT_RAW/$stem"
  local marker="$dest/.cfr-done"

  extract_nested "$jar_name"
  local jar_path="$LIBS_DIR/$jar_name"

  if [[ -f "$marker" ]]; then
    local prev_sha
    prev_sha="$(cut -d' ' -f1 "$marker" 2>/dev/null || true)"
    local cur_sha
    cur_sha="$(shasum -a 256 "$jar_path" | awk '{print $1}')"
    if [[ "$prev_sha" == "$cur_sha" ]]; then
      echo "  [cache] $jar_name"
      return 0
    fi
  fi

  echo "  [cfr]   $jar_name → $dest"
  mkdir -p "$dest"
  # comments false reduz ruído do decompiler; caseinsensitivefs para macOS
  "$JAVA_BIN" -jar "$CFR" "$jar_path" \
    --outputdir "$dest" \
    --caseinsensitivefs true \
    --comments false \
    --silent true \
    --clobber true

  shasum -a 256 "$jar_path" > "$marker"
  echo "done $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$marker"
}

if [[ "${1:-}" == "--list" ]]; then
  printf '%s\n' "${DEFAULT_JARS[@]}"
  exit 0
fi

if [[ $# -gt 0 ]]; then
  TARGETS=("$@")
else
  TARGETS=("${DEFAULT_JARS[@]}")
fi

echo "==> Decompilação seletiva e-SUS $VERSION"
echo "    JAVA: $("$JAVA_BIN" -version 2>&1 | head -1)"
echo "    CFR:  $CFR"
echo "    OUT:  $OUT_RAW"
echo

for j in "${TARGETS[@]}"; do
  decompile_one "$j"
done

echo
echo "==> Concluído. Próximo: normalizar + extrair specs por módulo."

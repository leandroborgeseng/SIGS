# Toolchain de análise e decompilação

**Atualizado:** 2026-08-10

## Instalado neste workspace

| Ferramenta | Local | Versão |
|---|---|---|
| JDK Temurin | `tools/java-home` → `tools/jdk-17/Contents/Home` | 17.0.20 |
| CFR | `tools/cfr-0.152.jar` | 0.152 |
| Python | sistema | 3.9.6 |

> O JRE embutido no instalador e-SUS é **Linux x64** — não usar no macOS arm64.

## Comandos

```bash
# Inventário + classificação + mapas 01–10
./scripts/analyze-esus.sh
python3 -m sus_intelligence esus analyze

# Status
python3 -m sus_intelligence esus status
cat STATUS.md

# Decompilação seletiva (P0 padrão)
./scripts/decompile-esus.sh
./scripts/decompile-esus.sh --list
./scripts/decompile-esus.sh pec.business.impl-5.5.24.jar
```

## Variáveis úteis

```bash
export JAVA_HOME="$(pwd)/tools/java-home"
export PATH="$JAVA_HOME/bin:$PATH"
```

## Git

Não versionar:

- `e-SUS/*.jar`
- `cache/`
- `tools/jdk-17/`, `tools/java-home`
- `data/esus/*/decompiled/raw/`

Versionar:

- scripts, `sus_intelligence/`, docs, manifests, specs normalizadas, context packs

Ver `.gitignore`.

## Smoke test já executado

`pec.extension.impl-5.5.24.jar` → 2 classes Java em  
`data/esus/5.5.24/decompiled/raw/pec.extension.impl-5.5.24/`.

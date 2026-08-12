# Pipeline — como operar

## Fluxo atual

```text
JAR instalador
  → analyze (manifest, inventário, classificação, mapas)
  → decompile seletivo (CFR nos JARs P0)
  → normalize (futuro)
  → extract specs por módulo (futuro)
  → build-context (futuro)
  → agent implementa municipal-health-platform
```

## Fases

| Fase | Estado | Entrega |
|---|---|---|
| 1. Inventário | ✅ | `01`–`10`, inventory, STATUS |
| 2. Toolchain | ✅ | JDK 17 + CFR + `decompile-esus.sh` |
| 3. Decompilação P0 | ⏳ | raw em `decompiled/raw/` |
| 4. Specs por módulo | ⏳ | `data/esus/5.5.24/spec/` |
| 5. Gap TR × e-SUS × Java | ⏳ | `docs/requisitos/gap-analysis.md` |
| 6. Context packs | ⏳ | `contexts/<modulo>/` |

## Requisitos do município

Fonte: `docs/requisitos/RF-SGS-Franca-Anexo-I.md` (601 requisitos).

Instruções Cursor nesse arquivo: marcar `Implementado` / `Parcial` / `Não implementado`; gap analysis priorizando Obrigatório.

## Quando chegar nova instrução grande

1. Gravar em `docs/pipeline/` ou `docs/conhecimento/` com nome datado/descritivo.
2. Atualizar `docs/README.md` e `STATUS.md`.
3. Só então executar mudanças de código/pipeline.

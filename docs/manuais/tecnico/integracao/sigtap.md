---
id: faturamento.sigtap
title: Catálogo SIGTAP
type: technical
module: faturamento
feature: sigtap
version: 0.4.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-10.1, RF-9.1, RF-9.5]
related_screens: [/sigtap, /producao, /faturamento/auditoria]
updated_at: 2026-08-17
---

# Catálogo SIGTAP — técnico

## Modelo

- Prisma: `SigtapProcedure` → `sigtap_procedures` (`source`: seed | import | ms)
- Seed on init: `apps/api/src/sigtap/seed.ts` (~27 códigos piloto; `SKIP_SIGTAP_SEED=1`)
- Sync: `ensureSeeded` cria ausentes e atualiza só `source=seed`
- JSON piloto: `data/sigtap/piloto-franca.json`
- Fixture layout MS: `data/sigtap/fixture-tb-procedimento-sample.txt`
- Mapa ABPG (template): `data/sigtap/abpg-map-piloto.json`
- Fontes offline: `data/sigtap/README.md`

## Pipeline offline (preferido)

O site DATASUS costuma estar fora. Coloque o ZIP/TXT em `data/sigtap/` e:

```bash
npm run sync:sigtap
npm run sync:sigtap -- --file=data/sigtap/TabelaUnificada_202608.zip --competencia=202608
npm run sync:sigtap -- --seed --force
```

CLI: `apps/api/src/sigtap/cli-sync.ts` · loader: `local-file.loader.ts` (ZIP→TB_PROCEDIMENTO, TXT, CSV, JSON).

## API

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/v1/sigtap/procedures?q=` | autenticado |
| GET | `/api/v1/sigtap/procedures/:code` | autenticado |
| GET | `/api/v1/sigtap/seed-catalog` | autenticado |
| GET | `/api/v1/sigtap/offline-status` | autenticado |
| GET | `/api/v1/sigtap/abpg-map` | autenticado |
| POST | `/api/v1/sigtap/validate` | autenticado |
| POST | `/api/v1/sigtap/import` | `production.manage` (JSON stub) |
| POST | `/api/v1/sigtap/import-ms` | `production.manage` (TB_PROCEDIMENTO.txt body) |
| POST | `/api/v1/sigtap/import-file` | `production.manage` (multipart ZIP/TXT/CSV) |
| POST | `/api/v1/sigtap/import-local` | `production.manage` (lê `data/sigtap/`) |
| POST | `/api/v1/sigtap/seed?force=1` | `*` |

## Import MS

- Parser: `ms-procedimento.parser.ts` — layout largura fixa DATASUS
  - código 1–10, nome 11–260, competência 325–330
- Limite body API: 30 MB JSON · multipart upload ~40 MB
- Fontes do arquivo: ver `data/sigtap/README.md` (portal, FTP, espelho TI, Desktop)

## Faturamento / ABPG

- Auditoria: `SIGTAP_UNKNOWN` / `INACTIVE` / `COMPETENCIA` via `SigtapService.enrichProcedureCodes`
- PROC tipo 7: `PROC_CODE_ABPG` — hint lê `abpg-map-piloto.json` quando `sigtap` preenchido
- Repair ficha: `fixProcFichaProcedimentos` com SIGTAP 10 dígitos

## Testes

- `sigtap.seed.spec.ts`
- `ms-procedimento.parser.spec.ts`
- `local-file.loader.spec.ts`

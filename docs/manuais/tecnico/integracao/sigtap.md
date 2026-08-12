---
id: faturamento.sigtap
title: Catálogo SIGTAP
type: technical
module: faturamento
feature: sigtap
version: 0.3.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-10.1, RF-9.1, RF-9.5]
related_screens: [/sigtap, /producao]
updated_at: 2026-08-11
---

# Catálogo SIGTAP — técnico

## Modelo

- Prisma: `SigtapProcedure` → `sigtap_procedures` (`source`: seed | import | ms)
- Seed on init: `apps/api/src/sigtap/seed.ts` (~27 códigos piloto; `SKIP_SIGTAP_SEED=1`)
- Sync: `ensureSeeded` cria ausentes e atualiza só `source=seed`
- JSON piloto: `data/sigtap/piloto-franca.json`

## API

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/v1/sigtap/procedures?q=` | autenticado |
| GET | `/api/v1/sigtap/procedures/:code` | autenticado |
| GET | `/api/v1/sigtap/seed-catalog` | autenticado |
| POST | `/api/v1/sigtap/validate` | autenticado |
| POST | `/api/v1/sigtap/import` | `production.manage` (JSON stub) |
| POST | `/api/v1/sigtap/import-ms` | `production.manage` (TB_PROCEDIMENTO.txt) |
| POST | `/api/v1/sigtap/seed?force=1` | `*` |

## Import MS

- Parser: `ms-procedimento.parser.ts` — layout largura fixa DATASUS
  - código 1–10, nome 11–260, competência 325–330
- Body JSON: `{ content: "<arquivo>", competencia?: "YYYYMM", maxRows?: number }`
- Limite body API: 30 MB (`main.ts`)
- Fonte do arquivo: zip mensal em http://sigtap.datasus.gov.br (frequentemente indisponível)

## BPA

`ProductionService.exportBpa` → `enrichProcedureCodes` + `sigtap.known/unknown`

## Testes

- `sigtap.seed.spec.ts`
- `ms-procedimento.parser.spec.ts`

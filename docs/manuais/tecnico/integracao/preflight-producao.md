---
id: producao.preflight
title: Pré-envio de produção
type: technical
module: producao
feature: preflight
version: 0.1.0
product_min: 0.1.0
status: published
audience: [ti, faturamento, desenvolvedor]
related_rf: [RF-10.20, RF-10.4, RF-9.2, RF-9.5]
related_screens: [/producao]
updated_at: 2026-08-10
---

# Pré-envio de produção — técnico

## API

| Método | Rota | Notas |
|---|---|---|
| GET | `/api/v1/production/preflight?status=ready&competencia=` | Relatório completo |
| POST | `/api/v1/production/send` | Body `{ competencia?, batchIds?, force?, markBlockedAsError? }` |
| POST | `/api/v1/production/batches/:id/mark-sent` | Body `{ force? }` |
| POST | `/api/v1/production/batches/:id/reprocess` | Valida → ready ou error |
| POST | `/api/v1/production/batches/:id/mark-error` | → error |
| POST | `/api/v1/production/batches/:id/reopen` | sent → ready |
| GET | `/api/v1/production/bpa/export?requireOk=1` | Export só se pré-envio limpo |

## Severidades

- `BLOCKER` — impede envio
- `MONEY_RISK` — risco de glosa / não pagamento / perda de competência
- `QUALITY_WARN` — qualidade LEDI (ex.: enums em texto, INE ausente)

## Código

`apps/api/src/production/preflight.validator.ts`

## Testes

`preflight.validator.spec.ts`

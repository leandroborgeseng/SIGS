---
id: regulacao.basica
title: Regulação básica
type: technical
module: regulacao
feature: regulation
version: 0.1.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-2.3, RF-3.52, RF-3.59, RF-13.2, RF-13.4, RF-13.8]
related_screens: [/atendimento/[id], /regulacao, /regulacao/[id]]
updated_at: 2026-08-10
---

# Regulação básica — técnico

## Modelo

`RegulationComplex` · `RegulationProcedure` · `RegulationRequest`

Seed: `reg-seed.ts`. Skip: `SKIP_REG_SEED=1`.

## Status

`DRAFT` → `SUBMITTED` → `CLASSIFIED` → `AUTHORIZED` | `SCHEDULED` | `DENIED` | `RETURNED` → `CLOSED`

## API

| Método | Rota |
|---|---|
| GET | `/api/v1/regulation/catalog` |
| GET/POST | `/api/v1/regulation/requests` |
| POST | `/api/v1/regulation/requests/:id/submit\|classify\|authorize\|deny\|return\|close` |

`offProtocol=true` quando o código não está no catálogo pré-regulado (alerta RF-3.59).

## Testes

`regulation.service.spec.ts`

---
id: faturamento.auditoria
title: Auditoria de faturamento
type: technical
module: faturamento
feature: auditoria
version: 0.1.0
product_min: 0.2.0
status: draft
audience: [ti, desenvolvedor]
related_rf: [RF-10.21, RF-10.20, RF-9.5, RF-9.6]
related_screens: [/faturamento/auditoria]
updated_at: 2026-08-16
authors: [SIGS]
---

# Manual técnico — Auditoria de faturamento

**Versão:** 0.1.0-dev  
**RF:** RF-10.21 (auditoria) · RF-10.20 (produção) · RF-9.5 (SIGTAP) · RF-9.6 (CNES)  
**Escopo:** cruzar produção da competência com cadastros municipais. Sem PHI inventado.

## API

```
GET /v1/faturamento/audit?competencia=2026-08&ibge=3516200&gestao=municipal
```

Permissão: `production.manage`.

## Fontes auditadas

| Fonte | Filtro |
|---|---|
| `ProductionBatch` | `createdAt` na competência |
| `ProductionRecord` | `periodStart` (ou `createdAt` se nulo) |
| `Encounter` nativo | `finishedAt` + status `COMPLETED` |

## Checks

| Código | Severidade | Regra |
|---|---|---|
| `CNES_MISSING` / `CNES_FORMAT` | blocker | CNES ausente ou ≠7 dígitos |
| `CNES_NOT_IN_MUNICIPIO` | blocker | CNES fora do snapshot/SIGS municipal |
| `CNES_INACTIVE` | blocker | CNES inativo |
| `INE_MISSING` / `INE_NOT_FOUND` | blocker | INE ausente ou inexistente |
| `INE_CNES_MISMATCH` | blocker | INE aponta para outro CNES |
| `CNS_MISSING` | blocker | CNS profissional ausente |
| `CNS_NOT_IN_MUNICIPAL_CNES` | quality | CNS fora do snapshot PF da rede municipal (CnesWeb) |
| `CNS_NOT_LINKED` / `CBO_MISMATCH` | quality | lotação SIGS incompleta / CBO divergente (rode `sync-professionals`) |
| `SIGTAP_UNKNOWN` / `SIGTAP_INACTIVE` | blocker | procedimento fora do catálogo local |
| `SIGTAP_COMPETENCIA` | quality | competência do catálogo ≠ pedida |
| `CIAP_FORMAT` | quality | CIAP ≠ letra+2 dígitos |
| `CONDUTA_MISSING` | blocker | conduta/desfecho vazia (FAI/FAO/AD) |

## UI

`/faturamento/auditoria` — menu **Faturamento & Validação** · filtros · CSV.

Não altera o wizard LEDI (`/faturamento/lote/*`).

## Regressão

```bash
npm run smoke:cnes-pf-ledi
```

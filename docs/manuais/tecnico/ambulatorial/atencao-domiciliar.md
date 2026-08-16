---
id: ambulatorial.atencao-domiciliar
title: Atenção domiciliar (AD)
type: technical
module: ambulatorial
feature: home-care
version: 0.4.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-3.54, RF-10.4, RF-10.20]
related_screens: [/ad, /producao]
updated_at: 2026-08-16
---

# Atenção domiciliar — técnico

## API

| Método | Rota |
|---|---|
| GET | `/api/v1/catalog/home-care` |
| GET/POST | `/api/v1/home-care-visits` |
| GET | `/api/v1/home-care-visits/:id` |
| POST | `/api/v1/home-care-visits/:id/children` |
| DELETE | `/api/v1/home-care-visits/:id/children/:patientId` |
| POST | `/api/v1/home-care-visits/:id/preview` |
| POST | `/api/v1/home-care-visits/:id/finish` |

- `careType` ∈ `AD1|AD2|AD3`; `shift` ∈ `MANHA|TARDE|NOITE`
- Open aceita `patientId` **ou** `patientIds[]` **ou** `children[]` (máx. 99 — regra LEDI master)
- Persistência: `children_json` + `patient_id` âncora (1º child)
- `problemasCondicoes[]`: `ciap` e/ou `cid` (alias UI `cid10` → `cid`)
- Preview monta payload + `validateBatch` **sem** gravar lote; finish → `production_batches.kind = home_care` · BPA qty = N · SIGTAP `0101040024`
- Preflight AD: `AD_PROBLEMAS_MISSING` (QUALITY_WARN) se child sem CIAP/CID

## Testes

- `ledi-care-extra.mapper.spec.ts` — single + multi-child + cid10 alias
- `care-extra.service.spec.ts` — open · child · preview · finish com problemas
- `preflight.validator.spec.ts` — `AD_PROBLEMAS_MISSING`

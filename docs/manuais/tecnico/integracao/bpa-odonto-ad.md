# Manual técnico — BPA stub + odonto/AD

| Campo | Valor |
|---|---|
| id | integracao.bpa-odonto-ad |
| version | 0.2.0 |
| status | published |
| atualizado | 2026-08-10 |

**RF:** RF-10.4, RF-9.2, RF-12.1, RF-3.54, RF-10.20

## BPA stub

- `GET /api/v1/production/bpa/export?competencia=YYYYMM`
- Mapper: `apps/api/src/production/bpa-stub.mapper.ts` (`bpa-stub-v0`)
- Fonte: lotes `ready`/`sent` — `individual_encounter`, `vaccination`, `dental_encounter`, `home_care`, `collective_activity`
- `home_care` → SIGTAP `0101040024`

## Odonto / AD

| Método | Path |
|---|---|
| GET/POST | `/api/v1/dental-encounters` |
| POST | `/api/v1/dental-encounters/:id/finish` |
| GET | `/api/v1/catalog/home-care` |
| GET/POST | `/api/v1/home-care-visits` |
| GET | `/api/v1/home-care-visits/:id` |
| POST | `/api/v1/home-care-visits/:id/finish` |

Finish → `production_batches` + auditoria.

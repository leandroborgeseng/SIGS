---
id: ambulatorial.atencao-domiciliar
title: Atenção domiciliar (AD)
type: technical
module: ambulatorial
feature: home-care
version: 0.2.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-3.54, RF-10.4]
related_screens: [/ad, /producao]
updated_at: 2026-08-10
---

# Atenção domiciliar — técnico

## API

| Método | Rota |
|---|---|
| GET | `/api/v1/catalog/home-care` |
| GET/POST | `/api/v1/home-care-visits` |
| GET | `/api/v1/home-care-visits/:id` |
| POST | `/api/v1/home-care-visits/:id/finish` |

- `careType` ∈ `AD1|AD2|AD3`; `shift` ∈ `MANHA|TARDE|NOITE`
- Finish → `production_batches.kind = home_care` · BPA stub `0101040024`

## Testes

- `care-extra.service.spec.ts` — careType inválido

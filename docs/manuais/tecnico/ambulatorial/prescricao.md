---
id: ambulatorial.prescricao
title: Prescrição APS
type: technical
module: ambulatorial
feature: prescriptions
version: 0.1.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-3.33, RF-3.67, RF-2.11]
related_screens: [/atendimento/[id], /prescricoes, /prescricoes/[id]]
updated_at: 2026-08-10
---

# Prescrição APS — técnico

## Modelo

`Medication` · `Prescription` · `PrescriptionItem`

Seed municipal: `med-seed.ts` (LOS50, MET850, DIP500, AMO500, OME20, ENOX40). Skip: `SKIP_MED_SEED=1`.

## API

| Método | Rota | Auth |
|---|---|---|
| GET | `/api/v1/catalog/medications` | sim |
| GET | `/api/v1/catalog/prescription-params` | sim |
| POST | `/api/v1/catalog/medications/seed` | sim |
| GET/POST | `/api/v1/prescriptions` | sim |
| GET | `/api/v1/prescriptions/:id` | sim |
| POST | `/api/v1/prescriptions/:id/issue` | sim (`forceOffCatalog` se off-catalog) |
| POST | `/api/v1/prescriptions/:id/cancel` | sim |

Item: `medicationId` **ou** `freeTextName`. Emissão com off-catalog exige `forceOffCatalog: true`.

## Testes

`prescriptions.service.spec.ts`

# Manual técnico — Atividade coletiva APS

| Campo | Valor |
|---|---|
| id | ambulatorial.coletivo |
| version | 0.1.0 |
| status | draft |
| atualizado | 2026-08-10 |

**RF:** RF-3.53 (Obrigatório)

## Endpoints

| Método | Path |
|---|---|
| GET | `/api/v1/catalog/collective` |
| GET/POST | `/api/v1/collective-activities` |
| GET | `/api/v1/collective-activities/:id` |
| POST | `/api/v1/collective-activities/:id/finish` |

Finish exige `participantCount >= 1` → lote `collective_activity` (BPA qty = participantes).

Modelo: `CollectiveActivity` em Prisma.

---
id: ambulatorial.fila-senha
title: Totem e painel de senha
type: technical
module: ambulatorial
feature: queue
version: 0.1.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-3.10, RF-3.11, RF-3.23]
related_screens: [/totem, /guiche, /painel]
updated_at: 2026-08-10
---

# Totem e painel — técnico

## Modelo

`QueueTicket` → `queue_tickets` (código diário N001/P001/…)

## API

| Método | Rota | Auth |
|---|---|---|
| GET | `/api/v1/queue/catalog` | sim |
| GET | `/api/v1/queue/panel?facilityId=` | **público** |
| GET | `/api/v1/queue/tickets` | sim |
| POST | `/api/v1/queue/tickets` | sim (emit) |
| POST | `/api/v1/queue/tickets/:id/call` | sim |
| POST | `/api/v1/queue/call-next` | sim |
| POST | `/api/v1/queue/tickets/:id/finish` | sim |

`call` / `call-next` com `openEncounter: true` reusa ou abre encounter WAITING se houver `patientId`.

## Testes

`queue.service.spec.ts`

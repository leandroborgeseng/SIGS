---
id: cadastros.lotacao-endereco
title: Endereço e lotação
type: technical
module: cadastros
feature: address-lotation
version: 0.1.0
product_min: 0.1.0
status: published
audience: [ti, desenvolvedor]
related_rf: [RF-2.27, RF-2.60, RF-2.2]
related_screens: [/pacientes, /pacientes/novo, /pacientes/[id], /lotacoes]
updated_at: 2026-08-10
---

# Endereço e lotação — técnico

## Paciente

Campos: `addressStreet|Number|Complement|Neighborhood|City|State|Zip` em `patients`.

## Lotação

Modelo `ProfessionalAssignment` (`professional_assignments`).

| Método | Rota |
|---|---|
| GET | `/api/v1/assignments?facilityId=&activeOnly=` |
| POST | `/api/v1/assignments` |
| POST | `/api/v1/assignments/:id/end` |

CBO: 4–6 dígitos. Equipe, se informada, deve ser da mesma unidade.

## Testes

`organization.service.spec.ts`

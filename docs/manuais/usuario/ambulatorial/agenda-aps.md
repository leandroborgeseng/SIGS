---
id: aps.agenda
title: Agenda APS
type: user
module: ambulatorial
feature: aps-agenda
version: 0.1.0
product_min: 0.2.0
status: stub
audience: [profissional, recepcao]
related_rf: [RF-3.5, RF-2.17, RF-2.36, RF-12.1]
related_screens: [/aps/agenda, /aps, /aps/[id], /odonto/agenda, /agenda]
updated_at: 2026-08-13
authors: [SIGS]
---

# Agenda APS — ficha FAI a partir do slot (stub)

**Tela:** `/aps/agenda`  
**API:** mesmos `AppointmentSlot` da odonto · `POST /v1/appointments/:id/open-aps`

O modelo de agenda é **genérico** (`careLine` APS | ODONTO | GENERAL). Esta tela filtra APS+GENERAL e abre `/aps/[id]` (FAI tipo 4).

## Como usar

1. Menu **Atendimento clínico → Agenda APS**.
2. Grade do dia ou lista; tipo **Consulta agendada** (tipoAtendimento=2) ou **Encaixe** (tipo 5).
3. **Abrir** cria Encounter origem FAI vinculado ao slot e marca Presente.
4. Abertura sem agenda continua em `/aps` (tipo padrão 5).

## Limites

Mesmos da agenda odonto: sem cadastro TR completo de tipos de item, sem salas, sem SAMU. Slots `careLine=ODONTO` não abrem FAI.

---
id: odonto.agenda
title: Agenda odontológica
type: user
module: odontologia
feature: dental-agenda
version: 0.2.0
product_min: 0.2.0
status: draft
audience: [profissional, recepcao]
related_rf: [RF-12.1, RF-12.2, RF-12.3, RF-2.17, RF-2.36]
related_screens: [/odonto/agenda, /odonto, /odonto/[id], /aps/agenda, /agenda]
updated_at: 2026-08-13
authors: [SIGS]
---

# Agenda odontológica (RF-12.1)

**Tela:** `/odonto/agenda`  
**API:** `GET/POST /v1/appointments` · `GET /v1/appointments/day-grid` · `GET /v1/appointments/catalog` · `POST /v1/appointments/:id/open-dental` · `PATCH …/status`

## Como usar

1. Selecione a unidade e o **dia**. A vista padrão é a **grade** (horários × profissional, faixa 07:00–19:00). Alternativa: lista do dia.
2. Clique numa célula vazia para preencher início/fim + profissional, ou preencha o formulário.
3. Tipo de item: **Consulta agendada** (LEDI `tipoAtendimento=2`) ou **Encaixe / consulta no dia** (`tipoAtendimento=5`).
4. **Abrir** cria a ficha odonto vinculada ao slot (`appointmentId`), marca **Presente** e navega para `/odonto/[id]`.
5. **Falta** → status `NO_SHOW`. **Continuar** reabre a ficha em andamento.

## Limites vs grade TR completa

- Tipos de item: só CONSULTA e ENCAIXE (não há cadastro livre RF-2.36 completo).
- Sem salas/consultório, agenda compartilhada municipal, encaixe automático, SAMU/TFD.
- Slots `careLine=APS` abrem em `/aps/agenda`, não aqui.
- Seeds sem dados reais de pacientes.

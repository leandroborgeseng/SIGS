---
id: odonto.agenda
title: Agenda odontológica — MVP
type: user
module: odontologia
feature: dental-agenda
version: 0.1.0
product_min: 0.2.0
status: draft
audience: [profissional, recepcao]
related_rf: [RF-12.1, RF-12.2, RF-12.3]
related_screens: [/odonto/agenda, /odonto, /odonto/[id], /agenda]
updated_at: 2026-08-12
authors: [SIGS]
---

# Agenda odontológica — MVP (RF-12.1 parcial)

**Tela:** `/odonto/agenda`  
**API:** `GET/POST /v1/appointments` · `POST /v1/appointments/:id/open-dental` · `PATCH …/status`

## Como usar

1. Selecione a unidade e o **dia**.
2. Crie agendamento: profissional, paciente, início/fim (lotação usada na abertura).
3. Em **Abrir atendimento**: cria ficha odonto vinculada ao slot (`appointmentId`), marca slot **Presente**, LEDI `tipoAtendimento=2` + tipo consulta programática, e navega para `/odonto/[id]`.
4. **Falta** → status `NO_SHOW`.
5. Se já houver encounter em andamento, **Continuar** reabre a mesma ficha.

## Limites do MVP

- Sem grade multi-agenda avançada, tipos de item de agenda, encaixe automático ou sala/consultório.
- Sem SAMU/TFD.
- Seeds sem dados reais de pacientes.
- Agenda geral `/agenda` continua disponível; atalho “Agenda odonto” aponta para este fluxo.

---
id: aps.atendimento
title: Atendimento APS — ficha FAI (Onda 1)
type: user
module: ambulatorial
feature: aps-fai-encounter
version: 0.1.0
product_min: 0.2.0
status: stub
audience: [profissional, gestor]
related_rf: [RF-3.1, RF-3.24, RF-2.60, RF-10.3, RF-10.20]
related_screens: [/aps, /aps/[id], /faturamento/aps, /faturamento/lote/fai]
updated_at: 2026-08-13
authors: [SIGS]
---

# Atendimento APS — ficha FAI (stub usuário)

**Telas:** `/aps` · `/aps/[id]` · pós-fechamento → `/faturamento/aps`  
**API:** `POST /v1/encounters` (`faiOrigin: true`) · `PUT …/clinical` · `GET …/preview-fai` · `POST …/finish` · `GET /v1/catalog/aps`

UI de produto (Claude Design) fica para a fase 2. Este stub descreve o shell técnico da Onda 1.

## Como usar

1. Menu **Atendimento clínico → Atendimento APS** (`/aps`).
2. Paciente + profissional + lotação/equipe (INE, mesmo padrão do odonto).
3. Na ficha: CIAP/CID, procedimentos SIGTAP, condutas FAI (não odonto).
4. Painel LEDI FAI (Siaps-ready) → **Finalizar e faturar**.
5. Fila do mês: `/faturamento/aps` (deep-link após finalizar).
6. Lote XML legado: `/faturamento/lote/fai`.

A fila SOAP (`/atendimento`) continua no grupo Operação e não mistura com `/odonto`.

---
id: aps.atendimento
title: Atendimento APS — ficha FAI (Onda 1)
type: user
module: ambulatorial
feature: aps-fai-encounter
version: 0.2.0
product_min: 0.2.0
status: stub
audience: [profissional, gestor]
related_rf: [RF-3.1, RF-3.5, RF-3.24, RF-2.60, RF-10.3, RF-10.20]
related_screens: [/aps, /aps/agenda, /aps/[id], /faturamento/aps, /faturamento/lote/fai]
updated_at: 2026-08-16
authors: [SIGS]
---

# Atendimento APS — ficha FAI (stub usuário)

**Telas:** `/aps` · `/aps/agenda` · `/aps/[id]` · pós-fechamento → `/faturamento/aps`  
**API:** `POST /v1/encounters` (`faiOrigin: true`) · `POST /v1/appointments/:id/open-aps` · `PUT …/clinical` · `GET …/preview-fai` · `POST …/finish` · `GET /v1/catalog/aps`  
**Convenção:** `docs/manuais/campos-siaps-previne.md` · ajuda: `aps.atendimento`

UI de produto (Claude Design) fica para a fase 2. Este stub descreve o shell técnico da Onda 1.

## Como usar

1. Menu **Atendimento clínico → Atendimento APS** (`/aps`) ou **Agenda APS** (`/aps/agenda`).
2. Sem agenda: paciente + profissional + lotação/equipe (INE, mesmo padrão do odonto). Com agenda: slot do dia (consulta tipo 2 ou encaixe tipo 5) → **Abrir**.
3. Na ficha: tipo/local/turno, antropometria (peso/altura/PC), SOAP, CIAP/CID, procedimentos SIGTAP, condutas FAI (não odonto).
4. Painel LEDI FAI (Siaps-ready) → **Finalizar e faturar**.
5. Fila do mês: `/faturamento/aps` (deep-link após finalizar).
6. Lote XML legado: `/faturamento/lote/fai`.

A fila SOAP (`/atendimento`) continua no grupo Operação e não mistura com `/odonto`.

## Campos Siaps × Previne (UI)

| Campo na tela | Tom | Motivo |
|---|---|---|
| `stNaoPossuiCpf` + justificativa | **Siaps** | BLOCKER identificação LEDI |
| Tipo de atendimento / local | **Siaps** | Aceite FAI; tipo também alimenta C1 |
| Turno | **Indicador** | QUALITY_WARN se ausente |
| Gestante | **Previne** | Denominadores clínicos (ex. C3) — doc 15 |
| Antropometria (peso/altura/PC) | **Previne** | C2–C6 no mesmo registro |
| CIAP / CID | **Siaps** | `problemasCondicoes` obrigatório |
| Condutas FAI | **Siaps** | `OUTCOMES_MISSING` BLOCKER |
| SOAP / anamnese textual | Neutro | Clínico local |

Na tela: vermelho = envio; laranja = indicador. Finalizar exige zero BLOCKER Siaps.

## Campos LEDI na ficha (Onda A 2026-08-16)

- Medições: `weightKg`, `heightCm`, `headCircumferenceCm` → `medicoes` no payload
- SOAP: subjetivo/objetivo/avaliação/plano → bloco `soap`
- Tipos de atendimento FAI: 1, 2, 4, 5, 6 (catálogo `/v1/catalog/aps`)

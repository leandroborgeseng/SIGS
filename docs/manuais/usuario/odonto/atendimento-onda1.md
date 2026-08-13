---
id: odonto.atendimento
title: Atendimento odontológico — Onda 1
type: user
module: odontologia
feature: dental-encounter
version: 1.3.0
product_min: 0.2.0
status: draft
audience: [profissional, gestor]
related_rf: [RF-12.1, RF-12.2, RF-12.3, RF-12.5, RF-12.6, RF-12.7, RF-12.8, RF-12.9, RF-12.12]
related_screens: [/odonto, /odonto/agenda, /odonto/[id], /faturamento/odonto]
updated_at: 2026-08-12
authors: [SIGS]
---

# Atendimento odontológico — Onda 1 (+ Previne na origem)

**Telas:** `/odonto` · `/odonto/agenda` · `/odonto/[id]` · pós-fechamento (Tela C) → `/faturamento/odonto`  
**API:** `POST/PATCH/GET /v1/dental-encounters` · `POST /v1/appointments/:id/open-dental` · `GET …/preview-fao` · `POST …/finish` · `POST …/void`  
**Desenho:** `docs/planejamento/desenho-atendimento-odontologico.md`

## Como usar

1. **Agendado:** `/odonto/agenda` → Abrir atendimento (tipo **2**). **Espontâneo:** `/odonto` → paciente, profissional e **lotação/equipe** → **Abrir** (tipo padrão **5**).
2. Na ficha: vigilância ≥1, CIAP/CID ≥1 (`CodeSearchSelect`), conduta ≥1 (catálogo LEDI), fornecimentos opcional, anamnese texto.
3. **Odontograma (parcial):** clique no dente FDI, marque condição (cárie, restaurado, etc.). O dente selecionado preenche o campo do procedimento SIGTAP. Decídua opcional (“Mostrar dentição decídua”).
4. Painel LEDI + **Previne ESB (B1–B6)** atualiza ~1s após editar; ou use **Validar agora**.
5. Evite vigilância só `99` (não se aplica) em massa — aviso de qualidade; **não** bloqueia Finalizar se Siaps ok.
6. **Finalizar e faturar** — só exige zero BLOCKER Siaps (avisos Previne orientam).
7. Tela C: atalho para fila com `encounterId`/`batchId`.
8. Fila e lote: `/faturamento/odonto` · `/faturamento/lote/fao`.
9. **Anular:** rascunho (`IN_PROGRESS`) ou pós-finalização (`COMPLETED`) com confirmação. Pós-COMPLETED é **anulação local** (sai da fila); não há recall no Ministério.

## Parametrização

| Env | Default Franca | Outra cidade |
|---|---|---|
| `REQUIRE_INE_DENTAL_OPEN` | `true` (prod) | `false` se não usar eSB |
| `DENTAL_DEFAULT_TIPO_ATENDIMENTO` | `5` | conforme protocolo |
| `MUNICIPIO_IBGE` | `3516200` | IBGE local |

## RF (Onda 1 + F + odontograma)

Cobertos no mínimo: RF-12.2, 12.3, 12.5, 12.6, 12.7, 12.8, 12.9 · Previne na origem (orientação).  
Parcial: RF-12.1 agenda do dia + open-dental; RF-12.12 odontograma FDI + quadrante/sextante/boca (sem histórico). RF-12.13 só `done` no SIGTAP. Depois: agenda TR rica, prótese.

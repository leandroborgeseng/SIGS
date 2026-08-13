---
id: odonto.atendimento
title: Atendimento odontológico — Onda 1
type: user
module: odontologia
feature: dental-encounter
version: 1.2.0
product_min: 0.2.0
status: draft
audience: [profissional, gestor]
related_rf: [RF-12.2, RF-12.3, RF-12.5, RF-12.6, RF-12.7, RF-12.8, RF-12.9]
related_screens: [/odonto, /odonto/[id], /faturamento/odonto]
updated_at: 2026-08-12
authors: [SIGS]
---

# Atendimento odontológico — Onda 1 (+ Previne na origem)

**Telas:** `/odonto` · `/odonto/[id]` · pós-fechamento (Tela C) → `/faturamento/odonto`  
**API:** `POST/PATCH/GET /v1/dental-encounters` · `GET …/preview-fao` · `POST …/finish` · `POST …/void`  
**Desenho:** `docs/planejamento/desenho-atendimento-odontologico.md`

## Como usar

1. Em `/odonto`, escolha unidade, paciente, profissional e **lotação/equipe** → **Abrir** (tipo padrão **5**).
2. Na ficha: vigilância ≥1, CIAP/CID ≥1 (`CodeSearchSelect`), conduta ≥1 (catálogo LEDI), fornecimentos opcional, anamnese texto.
3. Painel LEDI + **Previne ESB (B1–B6)** atualiza ~1s após editar; ou use **Validar agora**.
4. Evite vigilância só `99` (não se aplica) em massa — aviso de qualidade; **não** bloqueia Finalizar se Siaps ok.
5. **Finalizar e faturar** — só exige zero BLOCKER Siaps (avisos Previne orientam).
6. Tela C: atalho para fila com `encounterId`/`batchId`.
7. Fila e lote: `/faturamento/odonto` · `/faturamento/lote/fao`.
8. **Anular:** rascunho (`IN_PROGRESS`) ou pós-finalização (`COMPLETED`) com confirmação. Pós-COMPLETED é **anulação local** (sai da fila); não há recall no Ministério.

## Parametrização

| Env | Default Franca | Outra cidade |
|---|---|---|
| `REQUIRE_INE_DENTAL_OPEN` | `true` (prod) | `false` se não usar eSB |
| `DENTAL_DEFAULT_TIPO_ATENDIMENTO` | `5` | conforme protocolo |
| `MUNICIPIO_IBGE` | `3516200` | IBGE local |

## RF (Onda 1 + F)

Cobertos no mínimo: RF-12.2, 12.3, 12.5, 12.6, 12.7, 12.8, 12.9 · Previne na origem (orientação).  
Parciais / depois: agenda (12.1), odontograma rico, prótese.

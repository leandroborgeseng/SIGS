---
id: odonto.atendimento
title: Atendimento odontológico — Onda 1
type: user
module: odontologia
feature: dental-encounter
version: 1.1.0
product_min: 0.2.0
status: draft
audience: [profissional, gestor]
related_rf: [RF-12.2, RF-12.3, RF-12.5, RF-12.6, RF-12.7, RF-12.8, RF-12.9]
related_screens: [/odonto, /odonto/[id], /faturamento/odonto]
updated_at: 2026-08-12
authors: [SIGS]
---

# Atendimento odontológico — Onda 1 (stub usuário)

**Telas:** `/odonto` · `/odonto/[id]` · pós-fechamento (Tela C) → `/faturamento/odonto`  
**API:** `POST/PATCH/GET /v1/dental-encounters` · `GET …/preview-fao` · `POST …/finish` · `POST …/void` (só rascunho)  
**Desenho:** `docs/planejamento/desenho-atendimento-odontologico.md`

## Como usar

1. Em `/odonto`, escolha unidade, paciente, profissional e **lotação/equipe** → **Abrir** (tipo padrão **5**).
2. Na ficha: vigilância ≥1, CIAP/CID ≥1 (`CodeSearchSelect`), conduta ≥1 (catálogo LEDI), fornecimentos opcional, anamnese texto.
3. Painel LEDI atualiza ~1s após editar (debounce); ou use **Validar agora**.
4. **Finalizar e faturar** — só grava se zero BLOCKER.
5. Tela C: atalho para fila com `encounterId`/`batchId`.
6. Fila e lote: `/faturamento/odonto` · `/faturamento/lote/fao` (aliases antigos redirecionam).
7. **Anular** só em rascunho (`IN_PROGRESS`). Atendimento já finalizado não anula (gap de estorno).

## Parametrização

| Env | Default Franca | Outra cidade |
|---|---|---|
| `REQUIRE_INE_DENTAL_OPEN` | `true` (prod) | `false` se não usar eSB |
| `DENTAL_DEFAULT_TIPO_ATENDIMENTO` | `5` | conforme protocolo |
| `MUNICIPIO_IBGE` | `3516200` | IBGE local |

## RF (Onda 1)

Cobertos no mínimo Onda 1: RF-12.2, 12.3, 12.5, 12.6, 12.7, 12.8, 12.9.  
Parciais / depois: agenda (12.1), odontograma rico, prótese, Previne na origem (Onda 2).

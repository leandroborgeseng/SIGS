---
id: faturamento.lote-proc
title: Lote LEDI Procedimentos
type: user
module: faturamento
feature: lote-proc
version: 0.1.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento/lote/proc, /faturamento]
updated_at: 2026-08-12
authors: [SIGS]
---

# Lote LEDI Procedimentos (stub usuário)

**Tela:** `/faturamento/lote/proc` (alias `/procedimentos/lote`)  
**Ajuda in-app:** `faturamento.lote-proc`

## Como usar

1. Envie XMLs ou ZIP da Ficha de Procedimentos (tipo 7).
2. Priorize CPF/CNS, turno e CNES; ABPG/SIGTAP na edição da ficha.
3. Clique no alerta → guia → corrija em lote ou ficha a ficha.
4. Export: ZIP só conformes / ZIP atuais · dry-run · relatório `.md` (iguais ao FAO/FAI).
5. **Relatório do que falta** (após o tratamento): tabela + CSV/Markdown/**PDF (secretaria)** das fichas ainda não ideais (CPF mascarado `***.***.***-xx`). `GET …/pending-report?format=pdf`.

Hub: `/faturamento`. API: mesmos endpoints `dental/ledi/batches/:id/export.zip`, `pending-report`, etc.

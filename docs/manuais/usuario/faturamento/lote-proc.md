---
id: faturamento.lote-proc
title: Lote LEDI Procedimentos
type: user
module: faturamento
feature: lote-proc
version: 0.2.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento/lote/proc, /faturamento]
updated_at: 2026-08-14
authors: [SIGS]
---

# Lote LEDI Procedimentos (wizard)

**Tela:** `/faturamento/lote/proc` (alias `/procedimentos/lote`)  
**Ajuda in-app:** `faturamento.lote-proc`  
**Tipo:** Ficha de Procedimentos (tipo 7).

Mesmo wizard FAI/FAO. Priorize CPF/CNS, turno e CNES; ABPG/SIGTAP na ficha. ZIP de outro tipo é recusado (não analisa). Dois ZIPs: aptos para envio e pendentes.

**Regras:** `faturamento.funil-pre-envio` · `faturamento.regras-por-tipo` · `faturamento.cruzamentos` · `faturamento.siaps-vs-previne`.

Hub: `/faturamento`.

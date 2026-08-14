---
id: faturamento.lote-fao
title: Lote LEDI FAO — atendimento odontológico
type: user
module: faturamento
feature: lote-fao
version: 0.2.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento/lote/fao, /faturamento/odonto, /faturamento]
updated_at: 2026-08-14
authors: [SIGS]
---

# Lote LEDI FAO (wizard)

**Tela:** `/faturamento/lote/fao` (alias `/odonto/lote`)  
**Ajuda in-app:** `odonto.lote-ledi`  
**Tipo:** Ficha de Atendimento Odontológico (tipo 5).

Mesmo wizard das telas FAI/PROC: upload → gate de tipo → análise + gráfico → problema a problema → fechamento (antes × depois) → dois ZIPs (aptos para envio / ainda precisam correção) → ficha a ficha.

Pronto Siaps ≠ Pronto Previne (ESB B1–B6) ≠ 100% OK. ZIP FAI nesta tela é recusado e não analisa.

Produção nativa: `/faturamento/odonto`.

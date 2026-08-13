---
id: faturamento.hub
title: Faturamento & Validação — visão geral
type: user
module: faturamento
feature: hub
version: 0.1.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento, /faturamento/odonto, /faturamento/lote/fao]
updated_at: 2026-08-12
authors: [SIGS]
---

# Faturamento & Validação (stub)

**Tela:** `/faturamento`

Hub com atalhos (separado do clínico `/odonto`):

| Destino | Uso |
|---|---|
| `/faturamento/odonto` | Fila mensal odonto (cores LEDI; Atualizar / Revalidar) |
| `/faturamento/lote/fao` | Lote XML FAO |
| `/faturamento/lote/fai` | Lote FAI |
| `/faturamento/lote/proc` | Lote Procedimentos |
| `/producao` | Produção / BPA |

Nav lateral: grupo **Faturamento & Validação** (sanfona). Aliases antigos (`/odonto/lote`, etc.) redirecionam.

---
id: faturamento.hub
title: Faturamento & Validação — visão geral
type: user
module: faturamento
feature: hub
version: 0.2.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens:
  [
    /faturamento,
    /faturamento/odonto,
    /faturamento/aps,
    /faturamento/lote/fao,
    /faturamento/lote/fai,
    /faturamento/lote/proc,
  ]
updated_at: 2026-08-13
authors: [SIGS]
---

# Faturamento & Validação (stub)

**Tela:** `/faturamento`

Hub com atalhos (separado do clínico `/odonto`):

| Destino | Uso |
|---|---|
| `/faturamento/odonto` | Fila mensal odonto (cores LEDI; Atualizar / Revalidar) |
| `/faturamento/aps` | Fila mensal APS / FAI tipo 4 (mesmo padrão) |
| `/faturamento/lote/fao` | Lote XML FAO (tipo 5) — export ZIP · relatório do que falta |
| `/faturamento/lote/fai` | Lote FAI (tipo 4) — export ZIP · relatório do que falta |
| `/faturamento/lote/proc` | Lote Procedimentos (tipo 7) — export ZIP · relatório do que falta |
| `/producao` | Produção / BPA |

Nav lateral: grupo **Faturamento & Validação** (sanfona). Aliases antigos (`/odonto/lote`, `/aps/lote`, `/procedimentos/lote`) redirecionam.

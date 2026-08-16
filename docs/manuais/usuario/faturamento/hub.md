---
id: faturamento.hub
title: Faturamento & Validação — visão geral
type: user
module: faturamento
feature: hub
version: 0.3.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3, RF-10.21]
related_screens:
  [
    /faturamento,
    /faturamento/odonto,
    /faturamento/aps,
    /faturamento/lote/fao,
    /faturamento/lote/fai,
    /faturamento/lote/proc,
    /faturamento/lote/domicilio,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
    /faturamento/auditoria,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Faturamento & Validação

**Tela:** `/faturamento`

Hub com atalhos (separado do clínico `/odonto`):

| Destino | Uso |
|---|---|
| `/faturamento/odonto` | Fila mensal odonto (cores LEDI; Atualizar / Revalidar) |
| `/faturamento/aps` | Fila mensal APS / FAI tipo 4 (mesmo padrão) |
| `/faturamento/lote/fao` | Lote XML FAO (tipo 5) — wizard ZIP live |
| `/faturamento/lote/fai` | Lote FAI (tipo 4) — wizard ZIP live |
| `/faturamento/lote/proc` | Lote Procedimentos (tipo 7) — wizard ZIP live |
| `/faturamento/lote/domicilio` · `/visita-acs` · `/ad` | Stubs CDS 3/8/10 — sem upload até amostra XML |
| `/faturamento/auditoria` | Cruzamento ficha × CNES/INE/CNS/SIGTAP (competência) |
| `/producao` | Produção / BPA |

Nav lateral: grupo **Faturamento & Validação**. Aliases antigos (`/odonto/lote`, `/aps/lote`, `/procedimentos/lote`) redirecionam.

API catálogo live×stub: `GET /v1/faturamento/ledi-cds-lotes`.

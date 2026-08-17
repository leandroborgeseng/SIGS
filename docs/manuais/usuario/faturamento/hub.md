---
id: faturamento.hub
title: Faturamento & Validação — visão geral
type: user
module: faturamento
feature: hub
version: 0.4.0
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
    /faturamento/lote/cadastro-individual,
    /faturamento/lote/domicilio,
    /faturamento/lote/coletivo,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
    /faturamento/auditoria,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Faturamento & Validação

**Tela:** `/faturamento`  
**Ajuda in-app:** `faturamento.hub`

Hub com atalhos (separado do clínico `/odonto`):

| Destino | Uso |
|---|---|
| `/faturamento/odonto` | Fila mensal odonto (cores LEDI; Atualizar / Revalidar) |
| `/faturamento/aps` | Fila mensal APS / FAI tipo 4 (mesmo padrão) |
| `/faturamento/lote/fao` · `/fai` · `/proc` | Lotes XML 5 / 4 / 7 — wizard live |
| `/faturamento/lote/cadastro-individual` · `/domicilio` · `/coletivo` · `/visita-acs` · `/ad` | Lotes CDS 2 / 3 / 6 / 8 / 10 — wizard live |
| `/faturamento/auditoria` | Cruzamento ficha × CNES/INE/CNS/SIGTAP (competência) |
| `/producao` | Produção / BPA |

## Regras internas (todos os usuários)

| Artigo | Id |
|---|---|
| Funil pré-envio passo a passo | `faturamento.funil-pre-envio` |
| O que é checado por tipo de ficha | `faturamento.regras-por-tipo` |
| Cruzamentos produção × cadastro × CNES | `faturamento.cruzamentos` |
| Siaps (envio) × Previne (financiamento) | `faturamento.siaps-vs-previne` |

Nav lateral: grupo **Faturamento & Validação**. Aliases antigos (`/odonto/lote`, `/aps/lote`, `/procedimentos/lote`) redirecionam.

API catálogo: `GET /v1/faturamento/ledi-cds-lotes`. Vacina tipo **14** = stub.

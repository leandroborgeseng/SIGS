---
id: faturamento.lote-cds
title: Lote LEDI CDS — tipos 2, 3, 6, 8 e 10
type: user
module: faturamento
feature: lote-cds
version: 0.3.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-10.3, RF-2.29, RF-3.54]
related_screens:
  [
    /faturamento/lote/cadastro-individual,
    /faturamento/lote/domicilio,
    /faturamento/lote/coletivo,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
    /faturamento,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Lote LEDI CDS (wizard live)

**Ajuda in-app:** `faturamento.lote-cds`

| Tipo | Rota |
|---:|---|
| 2 Cadastro Individual | `/faturamento/lote/cadastro-individual` |
| 3 Domiciliar | `/faturamento/lote/domicilio` |
| 6 Coletivo | `/faturamento/lote/coletivo` |
| 8 Visita ACS | `/faturamento/lote/visita-acs` |
| 10 AD | `/faturamento/lote/ad` |

Mesmo funil dos lotes FAI/FAO/PROC: upload → gate → críticas → autofix → dois ZIPs. O dump Franca trouxe amostra XML só de 4/5/7; estes tipos usam regras de cabeçalho/identidade + mínimas por tipo (schema sintético). Calibre com ZIP municipal real quando houver.

**Regras detalhadas:** `faturamento.funil-pre-envio` · `faturamento.regras-por-tipo` · `faturamento.cruzamentos` · `faturamento.siaps-vs-previne`.

Vacina (tipo **14**) continua fora desta onda.

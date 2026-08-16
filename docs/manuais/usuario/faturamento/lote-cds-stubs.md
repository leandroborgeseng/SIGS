---
id: faturamento.lote-cds-stub
title: Lotes CDS stub — domicílio, visita ACS e AD
type: user
module: faturamento
feature: lote-cds-stub
version: 0.1.0
product_min: 0.2.0
status: stub
audience: [gestor, faturamento, profissional]
related_rf: [RF-10.3, RF-2.29, RF-3.54]
related_screens:
  [
    /faturamento/lote/domicilio,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
    /faturamento,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Lotes CDS stub (3 / 8 / 10)

**Telas:** `/faturamento/lote/domicilio` · `/visita-acs` · `/ad`  
**Ajuda in-app:** `faturamento.lote-cds-stub`

Estas telas **não** abrem wizard ZIP. O dump municipal Franca não trouxe amostras XML desses tipos.

| Código e-SUS | Tipo | Onde registrar hoje |
|---:|---|---|
| 3 | Cadastro domiciliar | `/territorio` |
| 8 | Visita ACS | `/territorio` |
| 10 | Atenção domiciliar | `/ad` |

## O que fazer

1. Use as telas nativas acima para registrar a produção.
2. Nos lotes **live** (FAI 4 / FAO 5 / Procedimentos 7), se o ZIP trouxer ficha 3/8/10, o sistema **recusa o lote** e aponta para o stub correspondente — sem analisar o XML.
3. Wizard real destes tipos só depois de amostra XML municipal.

## Não confundir

- Vacina LEDI = código **14** (não 2).
- Cadastro individual = código **2** (sem lote ZIP nesta fase).

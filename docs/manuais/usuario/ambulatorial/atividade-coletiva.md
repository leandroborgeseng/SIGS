---
id: coletivo.stub
title: Atividade coletiva
type: user
module: ambulatorial
feature: collective-activity
version: 0.4.0
product_min: 0.2.0
status: stub
audience: [profissional, gestor]
related_rf: [RF-3.53]
related_screens: [/coletivo]
updated_at: 2026-08-16
authors: [SIGS]
---

# Manual do usuário — Atividade coletiva

**Tela:** `/coletivo` · ajuda: `coletivo.stub` · convenção: `docs/manuais/campos-siaps-previne.md`

1. Menu **Atividade coletiva** (`/coletivo`)
2. Informe profissional (lotação), tipo LEDI, tema (saúde ou reunião), público, turno e procedimento SIGTAP
3. Opcional: marque participantes nominais (cidadão ↔ ficha) e/ou nº agregado
4. **Registrar atividade** → **Finalizar** para gerar produção (`ledi-collective-v2`)
5. Confira o lote em **Produção / BPA**

## Campos Siaps × Previne (UI)

| Campo na tela | Tom | Motivo |
|---|---|---|
| Tipo / tema / público | **Siaps** | Aceite LEDI coletivo |
| Nº de participantes (≥1) | **Siaps** | `COLLECTIVE_QTY` BLOCKER |
| Turno | **Indicador** | Qualidade |
| Procedimento SIGTAP (ex. escovação 0101050011) | **Previne** | B4 (escovação coletiva) — doc 15; fora da FAO individual |

---
id: faturamento.lote-fai
title: Lote LEDI FAI — atendimento individual
type: user
module: faturamento
feature: lote-fai
version: 0.1.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento/lote/fai, /faturamento]
updated_at: 2026-08-12
authors: [SIGS]
---

# Lote LEDI FAI (stub usuário)

**Tela:** `/faturamento/lote/fai` (alias `/aps/lote`)  
**Ajuda in-app:** `faturamento.lote-fai`

## Como usar

1. Envie XMLs ou ZIP da Ficha de Atendimento Individual (tipo 4).
2. Veja o funil Siaps e clique nos alertas para o guia de correção.
3. Corrija em lote (quando auto) ou abra a ficha.
4. Com prontas Siaps: **Baixar ZIP só conformes** (recomendado) ou ZIP com todas as atuais.
5. Use **Dry-run** para simular auto-correção; **Relatório fechamento (.md)** para arquivar.

API compartilhada com FAO/PROC: `GET …/export.zip`, `POST …/dry-run`, `GET …/closure-report`.

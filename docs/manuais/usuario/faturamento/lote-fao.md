---
id: faturamento.lote-fao
title: Lote LEDI FAO — atendimento odontológico
type: user
module: faturamento
feature: lote-fao
version: 0.1.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento/lote/fao, /faturamento/odonto, /faturamento]
updated_at: 2026-08-14
authors: [SIGS]
---

# Lote LEDI FAO (stub usuário)

**Tela:** `/faturamento/lote/fao` (alias `/odonto/lote`)  
**Ajuda in-app:** `odonto.lote-ledi`  
**Tipo:** Ficha de Atendimento Odontológico (tipo 5).

## Como usar

1. Envie XMLs ou ZIP da FAO.
2. Veja o funil Siaps × Previne e os buckets de tratamento.
3. Dry-run e correção em lote (ou ficha a ficha no modal).
4. **Relatório do que falta** após o tratamento: tabela na tela + baixar CSV/Markdown/**PDF (secretaria)**. Só fichas ainda não ideais. CPF `***.***.***-xx`. BLOCKER bloqueia Siaps/envio; MONEY_RISK e QUALITY_WARN são qualidade/Previne. O PDF é colorido (vermelho / laranja / oliva) para impressão e e-mail interno.
5. Export ZIP (só conformes ou atuais) e relatório de fechamento `.md`.

API: `GET /v1/dental/ledi/batches/:id/pending-report` (`?format=csv|md|pdf&severity=BLOCKER|MONEY_RISK|QUALITY_WARN`).

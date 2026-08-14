---
id: faturamento.lote-fai
title: Lote LEDI FAI — atendimento individual
type: user
module: faturamento
feature: lote-fai
version: 0.2.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento/lote/fai, /faturamento/aps, /faturamento]
updated_at: 2026-08-13
authors: [SIGS]
---

# Lote LEDI FAI

**Tela:** `/faturamento/lote/fai` (alias `/aps/lote`)  
**Ajuda in-app:** `faturamento.lote-fai`  
**Tipo:** Ficha de Atendimento Individual (tipo 4) — **não** é odonto (FAO tipo 5).

## Como usar

1. Envie XMLs ou ZIP da FAI. O ZIP (ex.: `sistemas.zip`) é lido inteiro na memória e sobe em fatias. No Safari, se a leitura falhar, use **Escolher de novo** pelo botão — não arraste do Finder.
2. Veja o **funil de qualidade** (Siaps × alerta de qualidade × envio final) e os **buckets** vermelho / laranja / verde (mesmo painel do FAO).
3. Clique no alerta → guia em modal (mini-dash do lote) → corrija em lote ou abra a ficha. Condutas = TipoEncaminhamentoIndividual, não odonto.
4. **Correção automática FAI:** use **Dry-run** (preview) e **Corrigir em lote (ajustes seguros)**. Aplica só o que é seguro: `stNaoPossuiCpf`, turno (padrão tarde), local (UBS), IBGE Franca, origem 3, UUID, encoding, dígitos de CNS/CPF quando o checksum já fecha. **Não** inventa CIAP/CID, conduta, profissional nem paciente — esses BLOCKERs só sugerem; abra a ficha.
5. Filtre por bucket, status ou nome do arquivo.
5. Com prontas Siaps: **Baixar ZIP só conformes** (recomendado) ou ZIP com todas as atuais.
6. Use **Dry-run** para simular auto-correção; **Relatório fechamento (.md)** para arquivar.

Produção nativa (ficha `/aps`, não XML legado): fila `/faturamento/aps` com deep-link `?encounterId=` / `?batchId=`. Lote XML: `?batchId=` (id da análise LEDI) reabre o lote.

API compartilhada com FAO/PROC: `GET …/export.zip`, `POST …/dry-run`, `POST …/auto-fix`, `GET …/closure-report`. FAI usa o mesmo batch XML persistido; o pipeline recusa CIAP/CBO/vigilância odonto.

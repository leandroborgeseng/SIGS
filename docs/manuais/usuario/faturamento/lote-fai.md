---
id: faturamento.lote-fai
title: Lote LEDI FAI — atendimento individual
type: user
module: faturamento
feature: lote-fai
version: 0.3.0
product_min: 0.2.0
status: draft
audience: [gestor, faturamento, profissional]
related_rf: [RF-12.7, RF-10.3]
related_screens: [/faturamento/lote/fai, /faturamento/aps, /faturamento]
updated_at: 2026-08-14
authors: [SIGS]
---

# Lote LEDI FAI (wizard)

**Tela:** `/faturamento/lote/fai` (alias `/aps/lote`)  
**Ajuda in-app:** `faturamento.lote-fai`  
**Tipo:** Ficha de Atendimento Individual (tipo 4) — **não** é odonto.

## Como usar o wizard

1. **Upload** — o sistema abre ficha a ficha. Auto vs pessoa. **Pronto Siaps** (pode enviar) ≠ **Pronto Previne** (qualidade) ≠ **100% OK** (os dois).
2. **Gate de tipo** — ZIP FAO/PROC nesta tela é recusado, **não analisa**, volta ao início.
3. **Análise** — quantidade, já podem enviar, erros, corrigem em lote vs individuais.
4. **Problema a problema** — modal sequencial (grave/abrangente → leve). Corrigir em lote ou deixar para individual.
5. **Fechamento** — campos corrigidos + gráfico antes × depois.
6. **Dois ZIPs** — `…-aptos-envio.zip` (Pronto Siaps) e `…-pendentes.zip` (ainda bloqueiam).
7. **Ficha a ficha** — residual uma ficha por vez (lista só como busca).

Safari / ZIP grande: fatias 512 KiB no rodapé da etapa 1 (não monta o ZIP na RAM).

Produção nativa (não XML): fila `/faturamento/aps`.

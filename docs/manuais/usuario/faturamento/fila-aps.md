---
id: faturamento.fila-aps
title: Fila de faturamento APS
type: user
module: faturamento
feature: fila-aps
version: 0.1.0
product_min: 0.2.0
status: stub
audience: [gestor, faturamento, profissional]
related_rf: [RF-3.24, RF-10.3, RF-10.20]
related_screens: [/faturamento/aps, /aps, /aps/[id], /faturamento/lote/fai]
updated_at: 2026-08-13
authors: [SIGS]
---

# Fila de faturamento APS (stub usuário)

**Tela:** `/faturamento/aps` (alias `/aps/faturamento`)  
**Ajuda in-app:** `faturamento.fila-aps`  
**API:** `GET /v1/encounters/faturamento-queue` · `POST …/faturamento-queue/sync`

UI de produto (Claude Design) fica para a fase 2. Este stub descreve o shell técnico.

## Como usar

1. Finalize a ficha em `/aps/[id]` (**Finalizar e faturar**).
2. Abra **Faturamento & Validação → Fila APS** (`/faturamento/aps`).
3. Filtre competência e bucket (bloqueia envio / qualidade / indicadores / pronto).
4. Deep-link `?encounterId=` / `?batchId=` destaca a ficha recém-fechada.
5. **Atualizar** revalida; **Revalidar pendências** faz sync em lote.
6. XML importado / ZIP: `/faturamento/lote/fai`.

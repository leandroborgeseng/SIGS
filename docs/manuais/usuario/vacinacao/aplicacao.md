---
id: vacinacao.aplicacao
title: Aplicação de vacina
type: user
module: vacinacao
feature: aplicacao
version: 1.3.0
product_min: 0.2.0
status: stub
audience: [profissional, gestor]
related_rf: [RF-14.1, RF-14.2, RF-14.4, RF-14.6, RF-14.7, RF-14.8, RF-14.11, RF-14.13]
related_screens: [/vacinacao]
updated_at: 2026-08-16
authors: [SIGS]
---

# Manual do usuário — Vacinação (stub)

**Status:** shell técnico em `/vacinacao` (UI Claude Design na fase 2).  
**RF:** RF-14.1, 14.2, 14.4, 14.6, 14.7, 14.8, 14.11, 14.13–19 (parciais).  
**Convenção:** `docs/manuais/campos-siaps-previne.md` · ajuda: `vacinacao.aplicacao`

## Como usar

1. Menu **Vacinação** → aba **Aplicar**.
2. Paciente + imunobiológico + estratégia + dose + lote/fabricante (+ validade opcional) + via/local.
3. Estratégia Especial → CBO e CID obrigatórios; BCG → comunicante de hanseníase.
4. Faixa etária seed bloqueia fora do calendário básico (ex.: rotavírus após ~8 meses).
5. **Registrar aplicação** → gera `ProductionBatch` kind `vaccination`. Se existir estoque do mesmo lote, baixa qty; se houver insumos vinculados ao imuno, baixa também.
6. Aba **Estoque / frio**:
   - Entrada de lote (opcional vínculo a equipamento frio)
   - Cadastro de **equipamento frio** e **caixa térmica**
   - **Leitura manual** de temperatura (marca OK / FORA da faixa)
   - **Insumos leves** + vínculo imuno → insumo (baixa na aplicação)
7. Aba **Cartão vacinal** → lista doses + **Imprimir PDF** (RF-14.13).
8. Aba **Lista do dia** → **Anular** (VOID local; devolve estoque e insumos; sem recall Siaps).
9. Confira lote em **Produção**.

## Campos Siaps × Previne (UI)

| Campo na tela | Tom | Motivo (preflight / registry) |
|---|---|---|
| Paciente | **Siaps** | Identificação da ficha |
| Imunobiológico / estratégia / dose | **Siaps** | `VAC_IMUNO_MISSING` e cascata LEDI |
| Lote / fabricante / via / local | **Siaps** | `VAC_LOT_MISSING` (MONEY_RISK) + aceite |
| CBO + CID (estratégia Especial) | **Siaps** | Obrigatórios na regra de estratégia Especial |
| Validade do lote / estoque frio | Neutro | Operacional local (não inventar indicador Previne vacinal aqui) |

## Fora desta fatia

IoT/alarmes contínuos, farmácia municipal geral, agendamento de atrasos, dump real `TB_FAIXA_ETARIA_VACINACAO` (imuno+estratégia+dose).

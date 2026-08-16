# Manual do usuário — Vacinação (stub)

**Status:** shell técnico em `/vacinacao` (UI Claude Design na fase 2).  
**RF:** RF-14.1, 14.2, 14.7, 14.8, 14.11, 14.13, 14.14, 14.15–16, 14.19 (parciais); 14.4/6/17–18 stub.

## Como usar

1. Menu **Vacinação** → aba **Aplicar**.
2. Paciente + imunobiológico + estratégia + dose + lote/fabricante (+ validade opcional) + via/local.
3. Estratégia Especial → CBO e CID obrigatórios; BCG → comunicante de hanseníase.
4. Faixa etária seed bloqueia fora do calendário básico (ex.: rotavírus após ~8 meses).
5. **Registrar aplicação** → gera `ProductionBatch` kind `vaccination` (LEDI v2 com ids numéricos). Se existir estoque do mesmo lote na unidade, a qty é baixada automaticamente.
6. Aba **Estoque / frio** → entrada de lote (qty, validade, faixa °C alvo, sala). **Não é** monitoramento contínuo de geladeira.
7. Aba **Cartão vacinal** → lista doses + **Imprimir PDF** (RF-14.13).
8. Aba **Lista do dia** → **Anular** (VOID local; devolve qty ao estoque se houve baixa; sem recall Siaps).
9. Confira lote em **Produção**.

## Fora desta fatia

Equipamentos frios, caixa térmica, IoT/alarmes, almoxarifado/insumos, agendamento de atrasos, dump real `TB_FAIXA_ETARIA_VACINACAO` com lookup imuno+estratégia+dose (RF-14.12 e aprofundamento 14.4/6/17–18).

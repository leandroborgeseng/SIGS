# Manual do usuário — Vacinação (stub)

**Status:** shell técnico em `/vacinacao` (UI Claude Design na fase 2).  
**RF:** RF-14.1, 14.2, 14.7, 14.8, 14.11, 14.13, 14.14 (parciais); estoque/frio 14.3–6 / 15–19 = stub.

## Como usar

1. Menu **Vacinação** → aba **Aplicar**.
2. Paciente + imunobiológico + estratégia + dose + lote/fabricante (+ validade opcional) + via/local.
3. Estratégia Especial → CBO e CID obrigatórios; BCG → comunicante de hanseníase.
4. Faixa etária seed bloqueia fora do calendário básico (ex.: rotavírus após ~8 meses).
5. **Registrar aplicação** → gera `ProductionBatch` kind `vaccination` (LEDI v2 com ids numéricos).
6. Aba **Cartão vacinal** → lista doses + **Imprimir PDF** (RF-14.13).
7. Aba **Lista do dia** → **Anular** (VOID local; exige ciência de que não há recall Siaps).
8. Confira lote em **Produção**.

## Fora desta fatia

Estoque em salas, rede de frio completa, agendamento de atrasos, sync DB `TB_FAIXA_ETARIA_VACINACAO` (RF-14.12 e aprofundamento 14.3–6 / 15–19).

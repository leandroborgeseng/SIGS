# Manual do usuário — Vacinação (stub)

**Status:** shell técnico em `/vacinacao` (UI Claude Design na fase 2).  
**RF:** RF-14.1, 14.2, 14.11, 14.13, 14.14 (parciais).

## Como usar

1. Menu **Vacinação** → aba **Aplicar**.
2. Paciente + imunobiológico + estratégia + dose + lote/fabricante + via/local.
3. Estratégia Especial → CBO e CID obrigatórios; BCG → comunicante de hanseníase.
4. **Registrar aplicação** → gera `ProductionBatch` kind `vaccination` (LEDI v2 com ids numéricos).
5. Aba **Cartão vacinal** → lista doses + **Imprimir PDF** (RF-14.13).
6. Confira lote em **Produção**.

## Fora desta fatia

Estoque em salas, rede de frio, faixa etária automática, agendamento de atrasos (RF-14.3–14.8, 14.12, 14.15–14.19).

# Manual do usuário — Vacinação (stub)

**Status:** shell técnico em `/vacinacao` (UI Claude Design na fase 2).  
**RF:** RF-14.1, 14.2, 14.4, 14.6, 14.7, 14.8, 14.11, 14.13–19 (parciais).

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

## Fora desta fatia

IoT/alarmes contínuos, farmácia municipal geral, agendamento de atrasos, dump real `TB_FAIXA_ETARIA_VACINACAO` (imuno+estratégia+dose).

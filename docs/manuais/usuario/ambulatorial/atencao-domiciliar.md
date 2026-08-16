# Manual do usuário — Atenção domiciliar

**Tela:** `/ad` · **RF-3.54** · mapper `ledi-homecare-v2`

1. Marque um ou mais cidadãos (mesma ficha LEDI, até 99).
2. Escolha modalidade AD1/AD2/AD3, turno, tipo (programado / não programado / pós-óbito), local, procedimento e condições avaliadas.
3. Informe **CIAP e/ou CID-10** (busca) e o desfecho previsto — enviados no finish.
4. **Registrar ficha AD** → opcionalmente **+ cidadão** → **Preflight** (avisos sem gravar lote) → **Finalizar** → lote `home_care` em Produção (quantidade BPA = nº de cidadãos).

UI Claude Design na fase 2. Lote XML AD / visita ACS tipo 8 permanece adiado.

# STATUS — SIGS

- **etapa_atual**: Stream F + VOID pós-COMPLETED (domínio odonto compartilhado)
- **entregue (A–F):**
  - Área `/faturamento` (hub · fila `/faturamento/odonto` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao` (`previne` / `vigilanciaOnly99`); não vira BLOCKER Siaps
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit); exige `acknowledgeLocalOnly`; sem recall Ministério
- **como usar:**
  1. `/odonto` — paciente + profissional + **lotação/equipe** → abrir
  2. `/odonto/[id]` — seções A; painel LEDI + Previne ~1s após editar; Finalizar e faturar
  3. Tela C → `/faturamento/odonto?encounterId=…&batchId=…` · **Anular (local)** se necessário
  4. Fila: **Atualizar** / **Revalidar pendências**; lote FAO: `/faturamento/lote/fao`
- **API:** `GET …/preview-fao` (siapsReady + previne) · `POST …/void` (`IN_PROGRESS` ou `COMPLETED`+`acknowledgeLocalOnly`)
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** VOID pós-envio não faz estorno/XML de exclusão no Ministério — só anulação local
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional
- **próximo:** smoke Railway · ondas clínicas TR (agenda/odontograma) quando priorizado

_Atualizado em 2026-08-12_

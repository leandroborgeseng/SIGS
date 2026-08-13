# STATUS — SIGS

- **etapa_atual**: Odontograma com escopos Q/S/BOCA (RF-12.12 parcial) na ficha odonto
- **entregue (A–F + odontograma):**
  - Área `/faturamento` (hub · fila `/faturamento/odonto` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao` (`previne` / `vigilanciaOnly99`); não vira BLOCKER Siaps
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit); exige `acknowledgeLocalOnly`; sem recall Ministério
  - **Odontograma:** grade FDI + escopos Q1–Q4 / S1–S6 / BOCA · condições tipadas · PATCH `odontogram` → `odontogramJson` → LEDI `odontograma` · seleção amarra `tooth` ou `region` do SIGTAP
- **como usar:**
  1. `/odonto` — paciente + profissional + **lotação/equipe** → abrir
  2. `/odonto/[id]` — seções A + odontograma (dente/escopo); painel LEDI + Previne ~1s após editar; Finalizar e faturar
  3. Tela C → `/faturamento/odonto?encounterId=…&batchId=…` · **Anular (local)** se necessário
  4. Fila: **Atualizar** / **Revalidar pendências**; lote FAO: `/faturamento/lote/fao`
- **API:** `GET /v1/catalog/dental` (`odontogram.scopes`) · `GET …/preview-fao` · `POST …/void`
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** VOID pós-envio não faz estorno/XML de exclusão no Ministério — só anulação local; Thrift FAO sem tooth/region (careJson/mapper); sem histórico odontograma / procedimentos predefinidos ricos (RF-12.13)
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional
- **próximo:** smoke Railway · RF-12.13/16 ricos · agenda 12.1 quando priorizado

_Atualizado em 2026-08-12_

# STATUS — SIGS

- **etapa_atual**: Agenda odonto MVP (RF-12.1 parcial) + odontograma (RF-12.12 parcial)
- **entregue (A–F + odontograma + agenda):**
  - Área `/faturamento` (hub · fila `/faturamento/odonto` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao`
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit)
  - **Odontograma MVP:** grade FDI · condições · PATCH `odontogram` → LEDI
  - **Agenda odonto (RF-12.1 parcial):** `/odonto/agenda` lista do dia · criar slot · `POST /v1/appointments/:id/open-dental` → encounter com `appointmentId` · slot PRESENT · tipoAtendimento=2
- **como usar:**
  1. `/odonto/agenda` — dia + profissional + paciente → **Agendar** → **Abrir atendimento**
  2. `/odonto` — abertura espontânea (tipo 5) se não houver slot
  3. `/odonto/[id]` — ficha + odontograma + LEDI/Previne → Finalizar e faturar
  4. Fila / lote FAO em `/faturamento/…`
- **API:** `GET/POST /v1/appointments` · `POST …/:id/open-dental` · `GET /v1/catalog/dental` · `POST …/void`
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** agenda sem tipos de item/grade multi-profissional; VOID sem recall Ministério; odontograma sem quadrante/sextante/histórico ricos
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional
- **próximo:** smoke Railway · RF-12.13/16 ricos · agenda TR (tipos de item)

_Atualizado em 2026-08-12_

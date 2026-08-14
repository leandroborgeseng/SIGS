# STATUS — SIGS

- **etapa_atual:** Complemento clínico odonto (legado SIGS 3.0 × `/odonto`) + wizard lote LEDI
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI Onda 1 + fila APS + LEDI P1 + autofix FAI + gap odonto 2026-08-14):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos em `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao`
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit)
  - **Odontograma (RF-12.12 parcial):** grade FDI · escopos Q1–Q4 / S1–S6 / BOCA · **faces careJson (cruz M/D/V/L/O)** · condições · PATCH `odontogram` → LEDI
  - **Ciclo tratamento ≠ concluir consulta:** `careJson.treatment` · botões distintos em `/odonto/[id]` (RF-12.4 / 12.7)
  - **Antecedentes / observações / planejamento / notas por dente** em careJson
  - **Encaminhamento MVP:** especialidade + justificativa + lista (`careJson.referrals`) — sem reservas
  - **Histórico RF-12.11:** `treatmentId` no item + filtro “só tratamento atual”
  - **Agenda (RF-12.1 / RF-3.5 / RF-2.36 parciais):** `AppointmentSlot` genérico (`itemType` CONSULTA=tipo 2 · ENCAIXE=tipo 5 · `careLine` ODONTO|APS|GENERAL) · grade `/odonto/agenda` e `/aps/agenda` · `GET /v1/appointments/day-grid` · `POST …/open-dental` · `POST …/open-aps`
  - **RF-12.13:** catálogo predefinido em `GET /v1/catalog/dental` · lista no odontograma · planejado/`done` · FAO só realizados
  - **APS FAI origem (Onda 1):** `/aps` · `/aps/[id]` · `GET /v1/catalog/aps` · `POST /v1/encounters` `faiOrigin` · `GET …/preview-fai` · finish → `ProductionBatch` `individual_encounter`
  - **Fila APS:** `/faturamento/aps` · `GET/POST /v1/encounters/faturamento-queue` · deep-link `encounterId`/`batchId` · alias `/aps/faturamento`
  - **LEDI P1:** finish/patch FAI (`/aps`) e FAO (`/odonto`) persistem `ProductionRecord` nativo (Encounter + Condition/Procedure); falha do motor não derruba o lote LEDI
- **como usar:**
  1. `/aps/agenda` — dia + profissional + paciente + tipo (consulta/encaixe) → **Agendar** → **Abrir** → ficha FAI `/aps/[id]`
  2. `/aps` — abertura espontânea (tipo 5) se não houver slot
  3. `/odonto/agenda` — mesma grade · **Abrir** → `/odonto/[id]` (tipo 2 ou 5 conforme o item)
  4. `/odonto` — abertura espontânea (tipo 5) se não houver slot
  5. `/odonto/[id]` — ficha + odontograma (faces) + ciclo tratamento + histórico filtrável + catálogo SIGTAP + LEDI/Previne → **Concluir consulta** (faturar)
  6. Filas / lotes em `/faturamento/…` · lote FAI XML em `/faturamento/lote/fai`
- **API:** `GET /v1/catalog/aps` · `GET/POST /v1/encounters` · `GET …/preview-fai` · `POST …/finish` · `GET/POST /v1/encounters/faturamento-queue` · agenda: `GET/POST /v1/appointments` · `GET …/day-grid` · `GET …/catalog` · `POST …/:id/open-dental` · `POST …/:id/open-aps` · odonto: `GET /v1/catalog/dental` · `GET …/odontogram-history` · `PATCH …/odontogram-history/:sourceId` · `POST …/void`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** agenda TR completa; VOID sem recall Ministério; histórico só mesma unidade (sem RNDS); Thrift FAO sem tooth/region/face; medicamentos/exames/impressos/PEP/reservas encaminhamento adiados — ver `docs/planejamento/desenho-atendimento-odontologico.md` § Gap SIGS 3.0
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional; **hotfix 2026-08-13:** `nest build` emite `apps/api/dist/main.js` (não `dist/api/src/main.js`); imagem Docker falha se o bootstrap faltar
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-14)

### Entregue nesta onda (odonto gap legado)
- Separação **Concluir consulta** × **Finalizar tratamento** (`careJson.treatment`)
- Faces do odontograma + textos clínico (planejamento/realizado/toothNotes/antecedentes/observações)
- Histórico com filtro por tratamento; encaminhamento MVP sem reservas
- Gap documentado (medicamentos, exames, impressos, PEP, Dentinho de Leite, reservas) em `docs/planejamento/desenho-atendimento-odontologico.md`

### Entregue nesta onda (LEDI wizard — mantido)
- **Wizard de lote LEDI** nas 3 telas (`LediTipoLotePage`): upload → gate de tipo → análise → correção ficha a ficha → dois ZIPs
- Autofix/dry-run async, PDF secretaria, hotfixes Safari/chunk — ver histórico de commits recentes

### Pendente
1. Smoke visual browser: `/odonto/[id]` — faces + ciclo tratamento + filtro histórico + encaminhamento + concluir consulta → fila FAO
2. Smoke visual: `/aps/agenda` → FAI → fila APS; wizard lote FAI/FAO
3. Redis/Bull (opcional em prod)
4. Fase 2 UI (Claude Design) — **não** nesta fase backend-first
5. Agenda TR além do MVP; histórico odonto outras unidades / RNDS (RF-12.18)
6. Toolbar odonto adiada: medicamentos, exames, impressos, PEP

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- **Hotfix prod:** entrypoint trata `prisma db push` + `--accept-data-loss` após dedupe de `appointment_id`
- Colunas novas em `appointment_slots`: `item_type` (default CONSULTA), `care_line` (default GENERAL)

_Atualizado em 2026-08-14 (gap odonto SIGS 3.0 + wizard lote LEDI)_

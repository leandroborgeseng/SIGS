# STATUS — SIGS

- **etapa_atual**: Ficha APS origem FAI tipo 4 (paralelo ao `/odonto`)
- **entregue (A–F + odontograma + agenda + RF-12.13 + RF-12.11 + APS FAI Onda 1):**
  - Área `/faturamento` (hub · fila `/faturamento/odonto` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao`
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit)
  - **Odontograma (RF-12.12 parcial):** grade FDI · escopos Q1–Q4 / S1–S6 / BOCA · condições · PATCH `odontogram` → LEDI
  - **Agenda odonto (RF-12.1 parcial):** `/odonto/agenda` lista do dia · criar slot · `POST /v1/appointments/:id/open-dental` → encounter com `appointmentId` · slot PRESENT · tipoAtendimento=2
  - **RF-12.13:** catálogo predefinido em `GET /v1/catalog/dental` · lista no odontograma · planejado/`done` · FAO só realizados
  - **RF-12.11:** `GET /v1/dental-encounters/:id/odontogram-history` · timeline na ficha (mesmo paciente + unidade; sem VOID)
  - **APS FAI origem (Onda 1):** `/aps` · `/aps/[id]` · `GET /v1/catalog/aps` · `POST /v1/encounters` `faiOrigin` · `GET …/preview-fai` · finish → `ProductionBatch` `individual_encounter`
- **como usar:**
  1. `/aps` — paciente + profissional + lotação → ficha FAI tipo 4 → Finalizar e faturar
  2. `/odonto/agenda` — dia + profissional + paciente → **Agendar** → **Abrir atendimento**
  3. `/odonto` — abertura espontânea (tipo 5) se não houver slot
  4. `/odonto/[id]` — ficha + odontograma + histórico + catálogo SIGTAP (concluir) + LEDI/Previne → Finalizar e faturar
  5. Fila / lote FAO em `/faturamento/…` · lote FAI XML em `/faturamento/lote/fai`
- **API:** `GET /v1/catalog/aps` · `GET/POST /v1/encounters` · `GET …/preview-fai` · `POST …/finish` · odonto: `GET/POST /v1/appointments` · `POST …/:id/open-dental` · `GET /v1/catalog/dental` · `GET …/odontogram-history` · `POST …/void`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** fila UI `/faturamento/aps` (espelho odonto) ainda não; agenda APS TR; LEDI P1 motor; agenda sem tipos de item/grade multi-profissional (RF-12.1 TR); VOID sem recall Ministério; histórico só mesma unidade (sem RNDS/copiar snapshot); Thrift FAO sem tooth/region
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-13)

### Entregue nesta onda
- **Ficha APS origem FAI tipo 4:** abrir/listar com paciente + profissional + lotação/INE; `care` mínimo (CIAP/CID, SIGTAP, condutas FAI); preview Siaps-ready; finish atualiza `ProductionBatch` `individual_encounter`; UI `/aps` no grupo clínico (não mistura `/odonto`)
- **Hotfix ZIP LEDI (browser):** a UI **não** manda o ZIP pelo gateway (`/upload-zip/chunk` quebrava `sistemas.zip` ~14 MB no Railway). Descompacta no cliente (`fflate`), ignora `__MACOSX`, envia XMLs em fatias ≤1 MB / ~80 fichas via `POST /upload` + `/:batchId/upload` (mesmo caminho do Arquivo.zip). Progresso `fichas 200/8149`. Tipo LEDI conferido — FAO na tela FAI é recusado. Amostra achatada: `node tools/make-sistemas-fai-amostra.cjs` → Desktop `sistemas-fai-amostra.zip` (~200 FAI). Job async ≥1500 permanece no ingest ZIP (CLI).

### Pendente
1. Smoke visual browser: `/aps` → ficha → CIAP/CID + SIGTAP + conduta → finalizar → conferir batch; `/odonto/agenda` → abrir → ficha → odontograma Q/S + histórico + catálogo SIGTAP concluir → finalizar → fila → ZIP FAI/FAO
2. Railway: confirmar `JWT_SECRET` ok; `SEED_ADMIN_PASSWORD` ≥12 chars; smoke ZIP FAI em `/faturamento/lote/fai` com `sistemas.zip` (unzip no browser → fatias XML) ou `sistemas-fai-amostra.zip` no Desktop; FAO com `Arquivo.zip` em `/faturamento/lote/fao`
3. Fila UI `/faturamento/aps` (espelho `/faturamento/odonto`) — gancho de batch já existe
4. LEDI P1 — campos individuais na ficha ligados ao motor `clinical-core`
5. Redis/Bull (opcional em prod — hoje opcional no boot)
6. Fase 2 UI (Claude Design) — **não** nesta fase backend-first
7. Agenda TR restante: tipos de item / grade multi-profissional (APS + odonto)
8. Histórico odonto extra: copiar snapshot para o atual; outras unidades; RNDS (RF-12.18)

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- **Hotfix prod:** entrypoint trata `prisma db push` + `--accept-data-loss` após dedupe de `appointment_id` (unique agenda odonto)

_Atualizado em 2026-08-13 (upload LEDI: unzip no browser + fatias XML; APS FAI origem tipo 4)_

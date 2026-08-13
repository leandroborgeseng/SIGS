# STATUS — SIGS

- **etapa_atual**: LEDI P1 — ficha APS/FAO nativa no motor `clinical-core` (FHIR-like)
- **entregue (A–F + odontograma + agenda + RF-12.13 + RF-12.11 + APS FAI Onda 1 + fila APS + LEDI P1):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao`
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit)
  - **Odontograma (RF-12.12 parcial):** grade FDI · escopos Q1–Q4 / S1–S6 / BOCA · condições · PATCH `odontogram` → LEDI
  - **Agenda odonto (RF-12.1 parcial):** `/odonto/agenda` lista do dia · criar slot · `POST /v1/appointments/:id/open-dental` → encounter com `appointmentId` · slot PRESENT · tipoAtendimento=2
  - **RF-12.13:** catálogo predefinido em `GET /v1/catalog/dental` · lista no odontograma · planejado/`done` · FAO só realizados
  - **RF-12.11:** `GET /v1/dental-encounters/:id/odontogram-history` · `PATCH …/odontogram-history/:sourceId` (copia snapshot + procs `done`) · timeline na ficha (mesmo paciente + unidade; sem VOID; não sobrescreve VOID/COMPLETED)
  - **APS FAI origem (Onda 1):** `/aps` · `/aps/[id]` · `GET /v1/catalog/aps` · `POST /v1/encounters` `faiOrigin` · `GET …/preview-fai` · finish → `ProductionBatch` `individual_encounter`
  - **Fila APS:** `/faturamento/aps` · `GET/POST /v1/encounters/faturamento-queue` · deep-link `encounterId`/`batchId` · alias `/aps/faturamento`
  - **LEDI P1:** finish/patch FAI (`/aps`) e FAO (`/odonto`) persistem `ProductionRecord` nativo (Encounter + Condition/Procedure); falha do motor não derruba o lote LEDI
- **como usar:**
  1. `/aps` — paciente + profissional + lotação → ficha FAI tipo 4 → Finalizar e faturar → `/faturamento/aps`
  2. `/odonto/agenda` — dia + profissional + paciente → **Agendar** → **Abrir atendimento**
  3. `/odonto` — abertura espontânea (tipo 5) se não houver slot
  4. `/odonto/[id]` — ficha + odontograma + histórico (usar snapshot) + catálogo SIGTAP (concluir) + LEDI/Previne → Finalizar e faturar
  5. Filas / lotes em `/faturamento/…` · lote FAI XML em `/faturamento/lote/fai`
- **API:** `GET /v1/catalog/aps` · `GET/POST /v1/encounters` · `GET …/preview-fai` · `POST …/finish` · `GET/POST /v1/encounters/faturamento-queue` · odonto: `GET/POST /v1/appointments` · `POST …/:id/open-dental` · `GET /v1/catalog/dental` · `GET …/odontogram-history` · `PATCH …/odontogram-history/:sourceId` · `POST …/void`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** agenda APS TR; agenda sem tipos de item/grade multi-profissional (RF-12.1 TR); VOID sem recall Ministério; histórico só mesma unidade (sem RNDS); Thrift FAO sem tooth/region
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional; **hotfix 2026-08-13:** `nest build` emite `apps/api/dist/main.js` (não `dist/api/src/main.js`); imagem Docker falha se o bootstrap faltar
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-13)

### Entregue nesta onda
- **LEDI P1:** finish/patch da ficha APS (FAI tipo 4) e odonto (FAO) gravam `ProductionRecord` `source=native` com Encounter + Condition (CIAP/CID) + Procedure (SIGTAP). `ProductionBatch`/XML LEDI inalterados; se o motor falhar, o finish segue.
- **Fila UI `/faturamento/aps`:** espelho de `/faturamento/odonto` (competência, unidade, buckets LEDI, deep-link, sync/refresh). API `GET/POST /v1/encounters/faturamento-queue`.
- **Ficha APS origem FAI tipo 4:** abrir/listar com paciente + profissional + lotação/INE; `care` mínimo (CIAP/CID, SIGTAP, condutas FAI); preview Siaps-ready; finish atualiza `ProductionBatch` `individual_encounter`; UI `/aps` no grupo clínico (não mistura `/odonto`)
- **Lote FAI = FAO em utilidade:** `/faturamento/lote/fai` reusa painel de qualidade, buckets bloqueio/qualidade/indicadores, mini-dash nos modais, export ZIP, filtros e textos tipo 4 (não odonto). Fila nativa: `/faturamento/aps` (`?encounterId=` / `?batchId=`).
- **Hotfix ZIP LEDI (browser):** a UI **não** manda o ZIP pelo gateway (`/upload-zip/chunk` quebrava `sistemas.zip` ~14 MB no Railway). Descompacta no cliente (`fflate`), ignora `__MACOSX`, envia XMLs em fatias ≤1 MB / ~80 fichas via `POST /upload` + `/:batchId/upload` (mesmo caminho do Arquivo.zip). Progresso `fichas 200/8149`. Tipo LEDI conferido — FAO na tela FAI é recusado. Amostra achatada: `node tools/make-sistemas-fai-amostra.cjs` → Desktop `sistemas-fai-amostra.zip` (~200 FAI). Job async ≥1500 permanece no ingest ZIP (CLI).
- **Hotfix Railway `dist/main.js`:** spec da API importava `apps/web` → `nest build` limpo emitia `dist/api/src/main.js`. `tsconfig.build.json` exclui specs e trava `rootDir=src`. Docker falha se `apps/api/dist/main.js` faltar.

### Pendente
1. Smoke visual browser: `/aps` → ficha → CIAP/CID + SIGTAP + conduta → finalizar → **fila `/faturamento/aps`**; `/odonto/agenda` → abrir → ficha → odontograma Q/S + histórico + catálogo SIGTAP concluir → finalizar → fila → ZIP FAI/FAO
2. Railway: confirmar `JWT_SECRET` ok; `SEED_ADMIN_PASSWORD` ≥12 chars; smoke ZIP FAI em `/faturamento/lote/fai` com `sistemas.zip` (unzip no browser → fatias XML) ou `sistemas-fai-amostra.zip` no Desktop; FAO com `Arquivo.zip` em `/faturamento/lote/fao`
3. Redis/Bull (opcional em prod — hoje opcional no boot)
4. Fase 2 UI (Claude Design) — **não** nesta fase backend-first
5. Agenda TR restante: tipos de item / grade multi-profissional (APS + odonto)
6. Histórico odonto extra: outras unidades; RNDS (RF-12.18)

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- **Hotfix prod:** entrypoint trata `prisma db push` + `--accept-data-loss` após dedupe de `appointment_id` (unique agenda odonto)

_Atualizado em 2026-08-13 (LEDI P1 motor nativo FAI/FAO)_

# STATUS — SIGS

- **etapa_atual:** Hotfix Safari Load failed no 1º chunk 512 KiB — XHR + JSON fallback + proxy Connection: close
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI Onda 1 + fila APS + LEDI P1 + autofix FAI):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao`
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit)
  - **Odontograma (RF-12.12 parcial):** grade FDI · escopos Q1–Q4 / S1–S6 / BOCA · condições · PATCH `odontogram` → LEDI
  - **Agenda (RF-12.1 / RF-3.5 / RF-2.36 parciais):** `AppointmentSlot` genérico (`itemType` CONSULTA=tipo 2 · ENCAIXE=tipo 5 · `careLine` ODONTO|APS|GENERAL) · grade `/odonto/agenda` e `/aps/agenda` · `GET /v1/appointments/day-grid` · `POST …/open-dental` · `POST …/open-aps`
  - **RF-12.13:** catálogo predefinido em `GET /v1/catalog/dental` · lista no odontograma · planejado/`done` · FAO só realizados
  - **RF-12.11:** `GET /v1/dental-encounters/:id/odontogram-history` · `PATCH …/odontogram-history/:sourceId` (copia snapshot + procs `done`) · timeline na ficha (mesmo paciente + unidade; sem VOID; não sobrescreve VOID/COMPLETED)
  - **APS FAI origem (Onda 1):** `/aps` · `/aps/[id]` · `GET /v1/catalog/aps` · `POST /v1/encounters` `faiOrigin` · `GET …/preview-fai` · finish → `ProductionBatch` `individual_encounter`
  - **Fila APS:** `/faturamento/aps` · `GET/POST /v1/encounters/faturamento-queue` · deep-link `encounterId`/`batchId` · alias `/aps/faturamento`
  - **LEDI P1:** finish/patch FAI (`/aps`) e FAO (`/odonto`) persistem `ProductionRecord` nativo (Encounter + Condition/Procedure); falha do motor não derruba o lote LEDI
- **como usar:**
  1. `/aps/agenda` — dia + profissional + paciente + tipo (consulta/encaixe) → **Agendar** → **Abrir** → ficha FAI `/aps/[id]`
  2. `/aps` — abertura espontânea (tipo 5) se não houver slot
  3. `/odonto/agenda` — mesma grade · **Abrir** → `/odonto/[id]` (tipo 2 ou 5 conforme o item)
  4. `/odonto` — abertura espontânea (tipo 5) se não houver slot
  5. `/odonto/[id]` — ficha + odontograma + histórico (usar snapshot) + catálogo SIGTAP (concluir) + LEDI/Previne → Finalizar e faturar
  6. Filas / lotes em `/faturamento/…` · lote FAI XML em `/faturamento/lote/fai`
- **API:** `GET /v1/catalog/aps` · `GET/POST /v1/encounters` · `GET …/preview-fai` · `POST …/finish` · `GET/POST /v1/encounters/faturamento-queue` · agenda: `GET/POST /v1/appointments` · `GET …/day-grid` · `GET …/catalog` · `POST …/:id/open-dental` · `POST …/:id/open-aps` · odonto: `GET /v1/catalog/dental` · `GET …/odontogram-history` · `PATCH …/odontogram-history/:sourceId` · `POST …/void`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** agenda TR completa (cadastro livre de tipos de item, salas, grade municipal compartilhada); VOID sem recall Ministério; histórico só mesma unidade (sem RNDS); Thrift FAO sem tooth/region
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional; **hotfix 2026-08-13:** `nest build` emite `apps/api/dist/main.js` (não `dist/api/src/main.js`); imagem Docker falha se o bootstrap faltar
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-14)

### Entregue nesta onda
- **Hotfix Safari 1º POST `/upload-zip/chunk` (512 KiB) “Load failed” sem HTTP:** `fetch`+Blob+octet-stream no Safari RST via proxy (não era tamanho; não era unzip). Fatias agora sobem com **XMLHttpRequest + ArrayBuffer**; se falhar, **POST JSON `{ data: base64 }`** (≤0,7 MB). Proxy: log, `Connection: close`, `proxyReq.setTimeout(0)`, nunca destrói o socket do cliente se o Nest ainda não respondeu. 1ª fatia = **200 JSON** `{ complete:false, index:0, received:1, total }` (só grava tmp); unzip só no job da última.
- **Hotfix Safari “Load failed” ~0.2 MB no lote FAI:** health/ready de prod estavam **ok** (API no ar ~17 h). O 0.2 MB **não era tamanho** — ZIP ≤5 MB unzipava no browser e POSTava XMLs em `/upload` (multipart). Safari via “Load failed” sem HTTP (proxy RST / CORS `*`+credentials). **ZIP agora sempre sobe em `/upload-zip/chunk`** (1 fatia se o ZIP for pequeno). Proxy devolve **502 JSON** se o Nest RST; CORS `*` reflecte Origin; fetch `same-origin`; health antes do envio (“API fora do ar”).
- **FAI lote fechamento:** `/faturamento/lote/fai` mostra **parte x/y**, depois **analisando no servidor** com poll `GET /v1/jobs/:id` (a última fatia devolve 202). Se o 202 se perder, `GET /v1/jobs/by-key/ledi-import-zip:{uploadId}`. Fatia falha no meio → **Retomar** (mesmo uploadId) ou **Recomeçar**. Autofix visível no detalhe: Dry-run + Corrigir em lote (só ajustes seguros; **não** inventa CIAP/CID/conduta).
- **Autofix FAI (lote XML):** catálogo de reparo + `POST /v1/dental/ledi/batches/:id/dry-run|auto-fix` no XML persistido. Seguros: stNaoPossuiCpf, turno=2, local UBS, IBGE Franca, tpCdsOrigem=3, UUID, encoding, dígitos CNS/CPF se checksum ok, qtd proc=1. **Não** inventa CIAP/CID, conduta, profissional, paciente (só sugere na ficha). UI `/faturamento/lote/fai`: Dry-run com preview + **Corrigir em lote (ajustes seguros)**.
- **Agenda TR restante (MVP fechável):** grade do dia (horários × profissional, faixa 07:00–19:00 ou dia inteiro) + tipos CONSULTA (tipoAtendimento=2) e ENCAIXE (tipo 5). Modelo `AppointmentSlot` genérico: `/odonto/agenda` abre FAO; `/aps/agenda` abre FAI. Sem mexer no upload ZIP/LEDI.
- **LEDI P1:** finish/patch da ficha APS (FAI tipo 4) e odonto (FAO) gravam `ProductionRecord` `source=native` com Encounter + Condition (CIAP/CID) + Procedure (SIGTAP). `ProductionBatch`/XML LEDI inalterados; se o motor falhar, o finish segue.
- **Fila UI `/faturamento/aps`:** espelho de `/faturamento/odonto` (competência, unidade, buckets LEDI, deep-link, sync/refresh). API `GET/POST /v1/encounters/faturamento-queue`.
- **Ficha APS origem FAI tipo 4:** abrir/listar com paciente + profissional + lotação/INE; `care` mínimo (CIAP/CID, SIGTAP, condutas FAI); preview Siaps-ready; finish atualiza `ProductionBatch` `individual_encounter`; UI `/aps` no grupo clínico (não mistura `/odonto`)
- **Hotfix ZIP LEDI (chunk 100 MB):** ZIP (qualquer tamanho, até **100 MB**) sobe em `POST /upload-zip/chunk` (512 KiB octet-stream, retry por parte). Unzip **yauzl no Node**; última fatia **enfileira** `ledi.import-zip`. Tmp em `/data/ledi-chunks` se `PROCESS_ROLE=all`.
- **Hotfix Railway `dist/main.js`:** spec da API importava `apps/web` → `nest build` limpo emitia `dist/api/src/main.js`. `tsconfig.build.json` exclui specs e trava `rootDir=src`. Docker falha se `apps/api/dist/main.js` faltar.

### Pendente
1. Smoke visual browser: `/aps/agenda` → abrir FAI; `/aps` → ficha → CIAP/CID + SIGTAP + conduta → finalizar → **fila `/faturamento/aps`**; `/odonto/agenda` grade → abrir → ficha → odontograma Q/S + histórico + catálogo SIGTAP concluir → finalizar → fila → ZIP FAI/FAO
2. Railway: confirmar `JWT_SECRET` ok; `SEED_ADMIN_PASSWORD` ≥12 chars; smoke ZIP FAI em `/faturamento/lote/fai` (qualquer ZIP → chunks + “analisando no servidor”); FAO com `Arquivo.zip` em `/faturamento/lote/fao`
3. Redis/Bull (opcional em prod — hoje opcional no boot)
4. Fase 2 UI (Claude Design) — **não** nesta fase backend-first
5. Agenda TR além do MVP: cadastro livre de tipos de item, salas, grade municipal compartilhada
6. Histórico odonto extra: outras unidades; RNDS (RF-12.18)

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- **Hotfix prod:** entrypoint trata `prisma db push` + `--accept-data-loss` após dedupe de `appointment_id` (unique agenda odonto)
- Colunas novas em `appointment_slots`: `item_type` (default CONSULTA), `care_line` (default GENERAL)

_Atualizado em 2026-08-13 (FAI lote fechamento: poll 202 + retomar/recomeçar + autofix visível)_

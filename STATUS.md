# STATUS — SIGS

- **etapa_atual**: **LEDI P1 ✅** · núcleo A0–A4 ok · próximo P2 / aceite lote
- **como usar agora:**
  1. UI lote: http://localhost:3000 → `/odonto/lote`
  2. Login: `admin@sigs.local` / `admin123`
  3. Núcleo: `POST /v1/clinical-core/{normalize-ledi,migrate,match,match-queue,export/rnds}`
  4. Arquitetura: `docs/planejamento/arquitetura-fhir-motor-paciente-mestre.md`
- **servidores locais:** API `:3001` · Web `:3000` (`npm run dev`)
- **feito (núcleo):**
  - FHIR-like `Sigs*` + adapter LEDI XML
  - Motor único no lote (`runRulesEngine` / A3-lite)
  - Paciente Mestre + `PatientIdentifier`
  - Unificação HIGH/MEDIUM/LOW + merge de FKs + fila de revisão
  - Migração XML → `ProductionRecord` (`POST /migrate`)
  - Stub exporter RNDS
  - P0 registry LEDI (78 códigos)
  - **LEDI P1:** campos individuais no modal (CPF/CNS/nascimento/sexo/prof CNS/datas/condutas/keepId)
- **canal:** LEDI XML → domínio Sigs* → Exporter LEDI (hoje) / RNDS (stub)
- **proxima_acao:** LEDI P2 (órfãos semi/auto: tpCdsOrigem, PROC_QTD…) **ou** validar lote Franca 1131
- **docker:** `docker compose up --build`

_Atualizado em 2026-08-12_

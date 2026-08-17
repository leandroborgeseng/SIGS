# STATUS — SIGS

- **etapa_atual:** Noite 16→17/08 — SIGTAP offline · deep-link auditoria · P×2 Paciente Mestre · gate INE finish · migração ZIP
- **entregue (onda noturna):**
  - **SIGTAP offline:** `npm run sync:sigtap` · `data/sigtap/` (README + fixture + abpg-map) · UI upload ZIP/TXT · `POST /import-file` `/import-local`
  - **Auditoria:** coluna Abrir → `/faturamento/aps|odonto?encounterId=` · paciente · lote `?batchId=`
  - **P×2:** `*_CNS_NOT_IN_CADASTRO_INDIVIDUAL` no lote LEDI + auditoria (MONEY_RISK/quality)
  - **Finish FAI/FAO:** INE obrigatório quando a equipe da lotação tem INE no CNES
  - **Migração ZIP:** `/pacientes/migracao` · `POST /v1/clinical-core/migrate-zip` · `npm run migrate:ledi-zip`
- **como usar (acordar):**
  1. SIGTAP: colocar ZIP em `data/sigtap/` → `npm run sync:sigtap` ou `/sigtap`
  2. Auditoria: `/faturamento/auditoria` → Abrir
  3. Migração: dry-run em `/pacientes/migracao` (sem marcar Persistir)
  4. Smoke: `npm run smoke:cnes-pf-ledi`
- **próximo / falta:**
  1. Dump `TB_FAIXA_ETARIA_VACINACAO` + lote vacina 14
  2. Calibrar regras CDS com ZIP municipal real
  3. Preencher `abpg-map-piloto.json` com SIGTAP oficiais
  4. Claude Design fase 2 · SAMU/LIS/TFD fora

## Retomar daqui — domingo 17/08/2026 (madrugada)

### Já fechado nesta noite
- Pipeline SIGTAP sem site DATASUS
- Deep-link auditoria
- Cruzamento cidadão × Paciente Mestre (P×2)
- Gate INE no finish quando equipe tem INE
- Migração ZIP dry-run/persist mínima

### Pendente
1. TB_FAIXA + vacina 14
2. XML real CDS 2/3/6/8/10 (hoje sintético)
3. Autofill ABPG→SIGTAP em massa (mapa ainda template)

### Notas handoff
- Não commitar `data/esus`, ZIPs SIGTAP oficiais, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- SHAs: ver git log desta noite (`f295ac1` SIGTAP · `8b622a1` deep-link · commits seguintes P×2/migrate)

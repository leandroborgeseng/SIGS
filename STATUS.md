# STATUS — SIGS

- **etapa_atual:** Onda 3 (madrugada 17/08) — vínculo NT 30 · completude cadastro · auditoria CSV
- **entregue (ondas 1–3):**
  - **Onda 1:** SIGTAP offline · deep-link auditoria · P×2 Paciente Mestre · gate INE finish · migração ZIP
  - **Onda 2:** ABPG map · Previne B1–B6 · Ajuda · smoke ampliado · UI SIGTAP/migração
  - **Onda 3:**
    - `PRODUCAO_SEM_VINCULO_EQUIPE` · `PRODUCAO_INE_NEQ_VINCULO` (produção × patient-team-links × INE header)
    - `CADASTRO_INCOMPLETO_SIAPS` · `CADASTRO_INCOMPLETO_PREVINE` (FieldHint / RF-2.30)
    - Auditoria: seção + CSV «vínculo/cadastro» + nota honesta se cobertura de links fraca
    - Ajuda cruzamentos/auditoria · smoke com `ledi-vinculo-completude`
- **como usar (acordar) — ondas 1–3:**
  1. SIGTAP: ZIP em `data/sigtap/` → `npm run sync:sigtap` ou `/sigtap`
  2. Auditoria: `/faturamento/auditoria` → seção **Sem vínculo / cadastro incompleto** · CSV vínculo/cadastro · Abrir
  3. Vínculos: `/territorio` (paciente↔equipe/INE) antes de esperar Previne alto
  4. Cadastro: `/pacientes` badges Siaps (vermelho) × Previne (laranja)
  5. Migração: dry-run `/pacientes/migracao` · FAO Previne B1–B6 no lote
  6. Smoke: `npm run smoke:cnes-pf-ledi`
- **próximo / falta (bloqueado sem usuário):**
  1. Dump `TB_FAIXA_ETARIA_VACINACAO` + lote vacina 14
  2. XML CDS real (2/3/6/8/10) — hoje sintético
  3. Claude Design fase 2 · SAMU/LIS/TFD fora
  4. Confirmar ABPG035 na competência municipal (ausente no enum 5.5.24)
  5. P2 cruzamentos: 8×3×2 VD, 6×B4 idade, 2×3 território ZIP, eSB↔eSF 20h

## Retomar daqui — domingo 17/08/2026 (manhã)

### Já fechado nesta noite
- Pipeline SIGTAP · deep-link · P×2 · INE · migrate · ABPG · Previne B1–B6
- **Onda 3:** NT 30 + completude cadastro na auditoria (API honesta + UI mínima)

### Pendente (precisa de você)
1. TB_FAIXA + vacina 14
2. ZIP/XML municipal real CDS
3. Claude Design / SAMU / LIS / TFD

### Notas handoff
- Não commitar `data/esus`, ZIPs SIGTAP oficiais, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- SHAs onda 1: `f295ac1` · `8b622a1` · `0f190e0` · `be4f3a5` · `6090fd7`
- SHAs onda 2: `47719f3` · `1a910d4` · `0266126` · `b6b012c` · `407ae17` · `2af0930`
- SHAs onda 3: `0e93126` NT30/completude API · `c0871a3` UI/Ajuda/smoke · HEAD (STATUS)

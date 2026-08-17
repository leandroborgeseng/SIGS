# STATUS — SIGS

- **etapa_atual:** Onda 4 fechada (noite 17/08) — P2 cruzamentos viáveis (visita · coletivo B4 · AD · território)
- **entregue (ondas 1–4):**
  - **Onda 1:** SIGTAP offline · deep-link auditoria · P×2 Paciente Mestre · gate INE finish · migração ZIP
  - **Onda 2:** ABPG map · Previne B1–B6 · Ajuda · smoke ampliado · UI SIGTAP/migração
  - **Onda 3:**
    - `PRODUCAO_SEM_VINCULO_EQUIPE` · `PRODUCAO_INE_NEQ_VINCULO` (NT 30)
    - `CADASTRO_INCOMPLETO_SIAPS` · `CADASTRO_INCOMPLETO_PREVINE`
    - Auditoria: seção + CSV vínculo/cadastro
  - **Onda 4:**
    - Visita (8) × mestre: `VISITA_CNS_NOT_IN_CADASTRO_INDIVIDUAL` + auditoria de `AcsHomeVisit`
    - `VISITA_HOUSEHOLD_NOT_FOUND` · `CADASTRO_SEM_DOMICILIO` (só se há households)
    - AD (10) multi-child: todos os CNS em `atendimentosDomiciliares` → `AD_CNS_NOT_IN_CADASTRO_INDIVIDUAL`
    - Coletivo: `COLETIVO_PARTICIPANTE_NOT_IN_CADASTRO` se lista CNS existir; `COLETIVO_B4_SEM_FAIXA_6_12` se B4 + idade resolúvel
    - **Gap honesto:** `/coletivo` nativo só tem contagem (sem lista CNS) — não inventa participantes/B4
    - Ajuda + seção/CSV «território P2» + smoke `ledi-onda4-cruzamentos`
- **como usar (acordar) — ondas 1–4:**
  1. SIGTAP: ZIP em `data/sigtap/` → `npm run sync:sigtap` ou `/sigtap`
  2. Auditoria: `/faturamento/auditoria` → seções vínculo/cadastro **e** território P2 · CSVs · Abrir
  3. Território: `/territorio` (vínculos + domicílio + visitas ACS)
  4. Cadastro: `/pacientes` badges Siaps × Previne
  5. Coletivo/AD: `/coletivo` · `/ad` (B4 faixa só com XML/lista + DN)
  6. Migração: dry-run `/pacientes/migracao` · FAO Previne B1–B6 no lote
  7. Smoke: `npm run smoke:cnes-pf-ledi`
- **próximo / falta (bloqueado sem usuário):**
  1. Dump `TB_FAIXA_ETARIA_VACINACAO` + lote vacina 14
  2. XML CDS real (2/3/6/8/10) — hoje sintético; coletivo nativo sem lista CNS
  3. Claude Design fase 2 · SAMU/LIS/TFD fora
  4. Confirmar ABPG035 na competência municipal
  5. eSB↔eSF 20h · motor VD Previne (C2–C6 janelas) ainda não

## Retomar daqui — domingo 17/08/2026 (acordar)

### Já fechado nesta noite (ondas 1–4)
- Pipeline SIGTAP · deep-link · P×2 · INE · migrate · ABPG · Previne B1–B6
- NT 30 + completude cadastro
- **Onda 4:** visita/AD/coletivo×mestre · domicílio · B4 faixa (condicional) · Ajuda/STATUS/smoke

### Checklist único ao acordar
1. `git log --oneline -12` — conferir SHAs ondas 1–4 abaixo
2. Smoke: `npm run smoke:cnes-pf-ledi`
3. Abrir `/faturamento/auditoria` — seções vínculo **e** território P2
4. Spot-check `/territorio` (visita+domicílio) · `/ad` multi · `/coletivo` (gap contagem)
5. Pendências suas: TB_FAIXA · XML municipal · Claude Design / SAMU-LIS-TFD

### Pendente (precisa de você)
1. TB_FAIXA + vacina 14
2. ZIP/XML municipal real CDS
3. Claude Design / SAMU / LIS / TFD

### Notas handoff
- Não commitar `data/esus`, ZIPs SIGTAP oficiais, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- SHAs onda 1: `f295ac1` · `8b622a1` · `0f190e0` · `be4f3a5` · `6090fd7`
- SHAs onda 2: `47719f3` · `1a910d4` · `0266126` · `b6b012c` · `407ae17` · `2af0930`
- SHAs onda 3: `0e93126` · `c0871a3` · `13567e0`/`f715861`/`9c5b35f`/`e79f3cd`
- SHAs onda 4: `552ee15` API P2 visita/AD/coletivo/território · `c195316` UI/Ajuda/smoke · `5f237c4`/`2f00c1e` STATUS · tip `b7f37c4`

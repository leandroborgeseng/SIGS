# STATUS — SIGS

- **etapa_atual:** Onda 2 (madrugada 17/08) — ABPG map · Previne B1–B6 · Ajuda · smoke ampliado
- **entregue (onda 1 + 2):**
  - **Onda 1:** SIGTAP offline · deep-link auditoria · P×2 Paciente Mestre · gate INE finish · migração ZIP
  - **Onda 2:**
    - Mapa `abpg-map-piloto.json` ligado (enum e-SUS → fixture/seed); hint PROC + teste
    - Painel pré-envio Previne B1–B6 (contagens honestas por ficha; B4 n/a)
    - Ajuda usuário: SIGTAP offline, `/pacientes/migracao`, deep-link Abrir, findings P×2
    - Smoke ampliado (SIGTAP / P×2 / Previne / PROC / deep-link)
    - UI `/sigtap` e `/pacientes/migracao` com dicas operacionais
- **como usar (acordar) — onda 1 + 2:**
  1. SIGTAP: ZIP em `data/sigtap/` → `npm run sync:sigtap` ou `/sigtap` · mapa ABPG em Ajuda `sigtap.catalogo`
  2. Auditoria: `/faturamento/auditoria` → coluna Abrir (deep-link) · olhe `*_CNS_NOT_IN_CADASTRO_INDIVIDUAL` (P×2)
  3. Migração: dry-run em `/pacientes/migracao` (sem Persistir) · depois persistir se quiser popular mestre
  4. FAO: `/faturamento/lote/fao` → painel **Pré-envio Previne B1–B6**
  5. PROC: lote com ABPG → hint sugere SIGTAP do mapa (exceto ABPG035)
  6. Smoke: `npm run smoke:cnes-pf-ledi`
- **próximo / falta (bloqueado sem usuário):**
  1. Dump `TB_FAIXA_ETARIA_VACINACAO` + lote vacina 14
  2. XML CDS real (2/3/6/8/10) — hoje sintético
  3. Claude Design fase 2 · SAMU/LIS/TFD fora
  4. Confirmar ABPG035 na competência municipal (ausente no enum 5.5.24)

## Retomar daqui — domingo 17/08/2026 (manhã)

### Já fechado nesta noite
- Pipeline SIGTAP sem site DATASUS
- Deep-link auditoria + P×2 + gate INE + migração ZIP
- Mapa ABPG operacional (hints) + painel Previne B1–B6 + Ajuda/smoke

### Pendente (precisa de você)
1. TB_FAIXA + vacina 14
2. ZIP/XML municipal real CDS
3. Claude Design / SAMU / LIS / TFD

### Notas handoff
- Não commitar `data/esus`, ZIPs SIGTAP oficiais, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- SHAs onda 1: `f295ac1` SIGTAP · `8b622a1` deep-link · `0f190e0` P×2 · `be4f3a5` INE · `6090fd7` migrate
- SHAs onda 2: `47719f3` ABPG map · `1a910d4` Previne B1–B6 · (Ajuda/smoke/STATUS neste push)

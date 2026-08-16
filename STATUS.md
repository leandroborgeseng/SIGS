# STATUS — SIGS

- **etapa_atual:** Domingo APS — stubs lote CDS 3/8/10 + detector LEDI alinhado ao enum; CNES/PF/FieldHint já fechados
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + AD polish + CNES municipal + PF + auditoria faturamento + FieldHint cadastros + stubs CDS lote):**
  - Área `/faturamento` (hub · filas · lotes LEDI live 4/5/7 · **stubs 3/8/10** · **`/faturamento/auditoria`**)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas seed PNI · **sem dump** `TB_FAIXA_ETARIA_VACINACAO` · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP**
  - **RF-2.30 / RF-2.29 / RF-17.11–12 / RF-3.54** (CDS · domicílio · visita ACS · AD) + **FieldHint Siaps/Previne**
  - **CNES (RF-10.2 / RF-9.6 / RF-2.2):** snapshot cidade + **filtro `gestao=municipal`** · **PF** · auditoria `CNS_NOT_IN_MUNICIPAL_CNES`
  - **Auditoria faturamento (RF-10.21):** `GET /v1/faturamento/audit?competencia=&ibge=3516200&gestao=municipal`
  - **Stubs lote CDS:** detecção tipos **3 / 8 / 10** (enum e-SUS) · telas `/faturamento/lote/{domicilio,visita-acs,ad}` · `GET /v1/faturamento/ledi-cds-lotes` · desenho `docs/planejamento/desenho-lote-ledi-cds-3-8-10.md` — **sem** wizard ZIP
- **como usar:**
  1. **Sincronizar rede municipal** em `/cadastros/cnes-auditoria` ou `/unidades`
  2. **Importar profissionais lotados** (mesmo tela) — ou `npm run sync:cnes -- --professionals`
  3. `/cadastros/cnes-auditoria` · `/faturamento/auditoria?competencia=YYYY-MM`
  4. API: `POST /v1/cnes/sync?gestao=municipal` · `POST /v1/cnes/sync-professionals` · `GET /v1/cnes/audit` · `GET /v1/faturamento/audit` · `GET /v1/faturamento/ledi-cds-lotes`
  5. Cadastro: `/pacientes/novo` · `/pacientes/[id]` · `/territorio`
  6. Lotes ZIP live: `/faturamento/lote/{fai,fao,proc}` · stubs CDS: `/faturamento/lote/{domicilio,visita-acs,ad}`
- **params:** `MUNICIPIO_IBGE` · `CNES_SNAPSHOT_PATH` · `CNES_PROFESSIONALS_SNAPSHOT_PATH` · `CNES_SYNC_ON_BOOT` · `CNES_SYNC_PROFESSIONALS_ON_BOOT` · `CNES_SYNC_GESTAO` · …
- **limite documentado:** PF só equipes CnesWeb (sem CPF); live depende de rede; wizard LEDI 4/5/7 intacto; CDS 3/8/10 = stub até amostra XML; faixas vacina = seed PNI ≠ TB e-SUS; detector vacina = código **14**
- **próximo:** ver **Retomar daqui — domingo 16/08/2026**

## Retomar daqui — domingo 16/08/2026

### Commits / ondas do dia (confirmados `git log`)

| Commit | Onda |
|--------|------|
| `6d3087d` | FAI SOAP/medições · vacina LEDI numérica/PDF · coletivo · AD |
| `7699d72` | Vacina catálogo/faixa/void · cadastro individual RF-2.30 |
| `a4ba05c` | Domicílio/família CDS territorial (RF-2.29) |
| `a938f16` | AD multi-child LEDI (RF-3.54) · condições · qty BPA |
| `00e180f` | Catálogo 99 imunobiológicos LEDI v3 + faixas Prisma |
| `3a44631` | Estoque/frio vacinal MVP |
| `b2928ca` | Frio/almox beyond-MVP |
| `760a436` | Visita ACS lat/long MVP |
| `8b3de08` | AD CIAP/CID UI + preview |
| `d1736e4` | CNES sync Franca + auditoria cadastro |
| `8a02ba1` | Auditoria de faturamento ficha×cadastros |
| `07d72eb` | CNES **só rede municipal** (natureza 1244) |
| `ef138bc` | Import **profissionais lotados** PF + audit CNS municipal |
| `c74e415` | Stub inventário Claude Design |
| `65a01d1` | Handoff STATUS CNES/PF |
| `551acf2` | FieldHint Siaps/Previne paciente + território |
| `8f50870` | Gap TB_FAIXA documentado + testes CDS/faixa |
| *(esta onda)* | Stubs lote CDS 3/8/10 + detector enum + manual CNES/PF |

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC (**live** — não quebrar)
- Estoque/frio · Visita ACS · Agenda CONSULTA/ENCAIXE · AD CIAP/CID
- **CNES sync + filtro Prefeitura + PF lotados** — não reabrir como stub
- **Auditoria de faturamento** (estendida com PF)
- **FieldHint Siaps/Previne** em fichas operacionais + cadastro paciente/território
- **Stubs CDS lote 3/8/10** (detecção + UI/API) — wizard ZIP só com amostra XML

### Pendente / próximos gaps
1. Import dump real `TB_FAIXA_ETARIA_VACINACAO` quando disponível (`AGE_SEED_META.officialDumpPresent` → true + seed/overlay)
2. Wizard ZIP cadastro domiciliar / visita ACS / AD — **após** ZIP amostra municipal (desenho + stub prontos)
3. Agenda TR residual (salas / grade municipal) — **skip**
4. Fase 2 UI Claude Design — inventário stub; UI completa **não** nesta fase
5. Fora APS P0: SAMU · Farmácia geral · Hospitalar

### Notas handoff
- Não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- **Commitar** `data/cnes/*.json` (público)
- Sem dados reais de pacientes (PF = cadastro público CNES: nome+CNS+CBO)
- Critério municipal: **natureza jurídica 1244**
- Ordem sync: unidades/equipes **antes** de profissionais
- Testar ao voltar: `cd apps/api && npx jest ledi-ficha-tipo ledi-cds-lote --testPathPattern='ledi-ficha-tipo|ledi-cds-lote'` · UI `/faturamento` + stubs · `GET /v1/faturamento/ledi-cds-lotes`

_Atualizado em 2026-08-16 (stubs lote CDS 3/8/10)_

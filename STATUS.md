# STATUS — SIGS

- **etapa_atual:** Domingo APS — FieldHint cadastros + gap faixa vacinal documentado; CNES/PF já fechados
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + AD polish + CNES municipal + PF + auditoria faturamento + FieldHint cadastros):**
  - Área `/faturamento` (hub · filas · lotes LEDI · **`/faturamento/auditoria`**)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas seed PNI · **sem dump** `TB_FAIXA_ETARIA_VACINACAO` · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP**
  - **RF-2.30 / RF-2.29 / RF-17.11–12 / RF-3.54** (CDS · domicílio · visita ACS · AD) + **FieldHint Siaps/Previne** em `/pacientes/*` e `/territorio`
  - **CNES (RF-10.2 / RF-9.6 / RF-2.2):** snapshot cidade + **filtro `gestao=municipal`** (natureza **1244** → 66 est. / 123 eq.) · **PF** `franca-3516200-professionals.json` (503 prof / 742 lot) · `POST /v1/cnes/sync-professionals` · UI sync + import PF · auditoria faturamento `CNS_NOT_IN_MUNICIPAL_CNES`
  - **Auditoria faturamento (RF-10.21):** `GET /v1/faturamento/audit?competencia=&ibge=3516200&gestao=municipal`
- **como usar:**
  1. **Sincronizar rede municipal** em `/cadastros/cnes-auditoria` ou `/unidades`
  2. **Importar profissionais lotados** (mesmo tela) — ou `npm run sync:cnes -- --professionals`
  3. `/cadastros/cnes-auditoria` · `/faturamento/auditoria?competencia=YYYY-MM`
  4. API: `POST /v1/cnes/sync?gestao=municipal` · `POST /v1/cnes/sync-professionals` · `GET /v1/cnes/audit` · `GET /v1/faturamento/audit`
  5. Cadastro: `/pacientes/novo` · `/pacientes/[id]` · `/territorio` (legenda Siaps/Previne)
  6. Fluxos APS/odonto/vacina/AD/lotes LEDI (inalterados)
- **params:** `MUNICIPIO_IBGE` · `CNES_SNAPSHOT_PATH` · `CNES_PROFESSIONALS_SNAPSHOT_PATH` · `CNES_SYNC_ON_BOOT` · `CNES_SYNC_PROFESSIONALS_ON_BOOT` · `CNES_SYNC_GESTAO` · …
- **limite documentado:** PF só equipes CnesWeb (sem CPF); live depende de rede; wizard LEDI intacto; faixas vacina = seed PNI ≠ TB e-SUS
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

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC
- Estoque/frio · Visita ACS · Agenda CONSULTA/ENCAIXE · AD CIAP/CID
- **CNES sync + filtro Prefeitura + PF lotados** — não reabrir como stub
- **Auditoria de faturamento** (estendida com PF)
- **FieldHint Siaps/Previne** em fichas operacionais + cadastro paciente/território

### Pendente / próximos gaps
1. Import dump real `TB_FAIXA_ETARIA_VACINACAO` quando disponível (`AGE_SEED_META.officialDumpPresent` → true + seed/overlay)
2. Lote XML cadastro domiciliar / visita ACS / AD — bloqueado até dump/TB
3. Agenda TR residual (salas / grade municipal) — **skip** (TR “salas” = estoque vacina, já parcial; CONSULTA/ENCAIXE ok)
4. Fase 2 UI Claude Design — inventário stub em `docs/design/inventario-telas-fase2-stub.md`; UI completa **não** nesta fase
5. Fora APS P0: SAMU · Farmácia geral · Hospitalar

### Notas handoff
- Não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- **Commitar** `data/cnes/*.json` (público)
- Sem dados reais de pacientes (PF = cadastro público CNES: nome+CNS+CBO)
- Critério municipal: **natureza jurídica 1244**
- Ordem sync: unidades/equipes **antes** de profissionais
- Testar ao voltar: `cd apps/api && npx jest patients.service.spec catalog.spec --testPathPattern='patients|catalog'` · UI `/pacientes/novo` + `/territorio` (badges)

_Atualizado em 2026-08-16 (FieldHint cadastros + gap faixa vacinal)_

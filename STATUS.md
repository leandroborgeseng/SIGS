# STATUS — SIGS

- **etapa_atual:** Domingo APS — **equipes CNES com membros + multi-equipe** (`/equipes`) + regressão CNES/PF/audit/LEDI; P0 desbloqueado esgotado sem amostra XML / TB_FAIXA
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + AD polish + CNES municipal + PF + auditoria faturamento + FieldHint cadastros + stubs CDS lote + regressão/handoff + explorer equipes):**
  - Área `/faturamento` (hub · filas · lotes LEDI live 4/5/7 · **stubs 3/8/10** · **`/faturamento/auditoria`**)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas seed PNI · **sem dump** `TB_FAIXA_ETARIA_VACINACAO` · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP**
  - **RF-2.30 / RF-2.29 / RF-17.11–12 / RF-3.54** (CDS · domicílio · visita ACS · AD) + **FieldHint Siaps/Previne**
  - **CNES (RF-10.2 / RF-9.6 / RF-2.2 / RF-2.19 / RF-2.61):** snapshot cidade + **filtro `gestao=municipal`** · **PF** · auditoria `CNS_NOT_IN_MUNICIPAL_CNES` · **UI `/equipes`** (membros · multi-equipe · labels tipo ex. **76=EAP**)
  - **Auditoria faturamento (RF-10.21):** `GET /v1/faturamento/audit?competencia=&ibge=3516200&gestao=municipal`
  - **Stubs lote CDS:** detecção tipos **3 / 8 / 10** · telas `/faturamento/lote/{domicilio,visita-acs,ad}` · `GET /v1/faturamento/ledi-cds-lotes` — **sem** wizard ZIP
  - **Regressão:** `npm run smoke:cnes-pf-ledi` (CNES 66 municipal · PF fixture · gate CDS · `CNS_NOT_IN_MUNICIPAL_CNES`)
- **como usar:**
  1. **Sincronizar rede municipal** em `/cadastros/cnes-auditoria` ou `/unidades`
  2. **Importar profissionais lotados** (mesmo tela ou `/equipes`) — ou `npm run sync:cnes -- --professionals`
  3. **`/equipes`** — clicar equipe → membros; painel «Em mais de uma equipe»
  4. `/cadastros/cnes-auditoria` · `/faturamento/auditoria?competencia=YYYY-MM`
  5. API: `POST /v1/cnes/sync?gestao=municipal` · `POST /v1/cnes/sync-professionals` · `GET /v1/cnes/teams` · `GET /v1/cnes/teams/:id` · `GET /v1/cnes/multi-team` · `GET /v1/cnes/team-types`
  6. Cadastro: `/pacientes/novo` · `/pacientes/[id]` · `/territorio`
  7. Lotes ZIP live: `/faturamento/lote/{fai,fao,proc}` · stubs CDS: `/faturamento/lote/{domicilio,visita-acs,ad}`
  8. Smoke: `npm run smoke:cnes-pf-ledi`
- **params:** `MUNICIPIO_IBGE` · `CNES_SNAPSHOT_PATH` · `CNES_PROFESSIONALS_SNAPSHOT_PATH` · `CNES_SYNC_ON_BOOT` · `CNES_SYNC_PROFESSIONALS_ON_BOOT` · `CNES_SYNC_GESTAO` · …
- **limite documentado:** PF só equipes CnesWeb (sem CPF); live depende de rede; wizard LEDI 4/5/7 intacto; CDS 3/8/10 = stub até amostra XML; faixas vacina = seed PNI ≠ TB e-SUS; detector vacina = código **14**
- **próximo:** ver **Retomar daqui — domingo 16/08/2026**

## Retomar daqui — domingo 16/08/2026

**Análise APS/LEDI (correção pré-Siaps):** [docs/planejamento/mvp-correcao-dados-aps.md](docs/planejamento/mvp-correcao-dados-aps.md) — veredito 4/5/7 ok; gap = CDS/vacina/vínculo/Previne; roadmap 1–8.

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
| `5db1740` | Stubs lote CDS 3/8/10 + detector enum + manual CNES/PF |
| `38517c1` | STATUS SHA stubs CDS |
| `6302a33` | Regressão CNES/PF/audit/LEDI + smoke `smoke:cnes-pf-ledi` |
| `bdf966c` | Manuais stubs CDS/auditoria + RF-10.21 no CSV + handoff STATUS |
| `f6cfecd` | Lista `/unidades` default **Rede Prefeitura** (~59) + CNPJ mantenedora |
| `dcf3756` | APIs `cnes/teams` · multi-team · network-export · catálogo 76=EAP · `TEAM_WITHOUT_MEMBERS` |
| `2da5b68` | UI `/equipes` + `/equipes/[id]` · polish `/lotacoes` · manuais RF-2.61 |

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC (**live** — não quebrar)
- Estoque/frio · Visita ACS · Agenda CONSULTA/ENCAIXE · AD CIAP/CID
- **CNES sync + filtro Prefeitura + PF lotados** — não reabrir como stub
- **Auditoria de faturamento** (estendida com PF)
- **FieldHint Siaps/Previne** em fichas operacionais + cadastro paciente/território
- **Stubs CDS lote 3/8/10** (detecção + UI/API) — wizard ZIP só com amostra XML
- **Regressão automatizada** `smoke:cnes-pf-ledi` + manuais stub CDS/auditoria (DoD docs)
- **Explorer equipes** `/equipes` + labels tipo CNES + multi-equipe

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
- Critério municipal: **natureza jurídica 1244** (66 est. / 59 ativos Franca) + CNPJ mantenedora **47970769000104** (enriquecimento; CNES `numero_cnpj` nulo na rede)
- Lista `/unidades` + `GET /v1/facilities` default **Rede Prefeitura** (não cidade ~545)
- Ordem sync: unidades/equipes **antes** de profissionais
- Testar ao voltar: `npm run smoke:cnes-pf-ledi` · UI `/equipes` · `/unidades` (~59) · `GET /v1/cnes/teams` · `GET /v1/cnes/multi-team`
- Matriz: `docs/rastreabilidade/cobertura-rf.csv` inclui **RF-2.28 / RF-2.61** (parcial) + RF-10.21

_Atualizado em 2026-08-16 (explorer equipes CNES + multi-equipe + catálogo tipo)_

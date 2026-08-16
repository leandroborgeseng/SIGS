# STATUS — SIGS

- **etapa_atual:** Domingo APS — **CNES rede municipal (Prefeitura)** fechado; próximo = import profissionais lotados (PF)
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + AD polish + CNES sync/audit municipal + auditoria faturamento):**
  - Área `/faturamento` (hub · filas · lotes LEDI · **`/faturamento/auditoria`**)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP**
  - **RF-2.30 / RF-2.29 / RF-17.11–12 / RF-3.54** (CDS · domicílio · visita ACS · AD)
  - **CNES (RF-10.2 / RF-9.6):** snapshot cidade `data/cnes/franca-3516200.json` (na imagem Docker) · **filtro default `gestao=municipal`** (natureza jurídica **1244** = Prefeitura; 66 est. / 123 eq. vs 1346/124 cidade) · sync · `GET /v1/cnes/audit` · UI `/cadastros/cnes-auditoria` (**Sincronizar rede municipal**) · opcional `CNES_SYNC_ON_BOOT=1`
  - **Auditoria faturamento (RF-10.21):** `GET /v1/faturamento/audit?competencia=&ibge=3516200` · UI `/faturamento/auditoria` · CSV · blocker vs quality
- **como usar:**
  1. UI **Sincronizar rede municipal** em `/cadastros/cnes-auditoria` ou `/unidades` (ou `npm run sync:cnes -- --ibge=3516200 --source=snapshot --gestao=municipal`)
  2. `/cadastros/cnes-auditoria` — abas Equipes/Unidades + inconsistências (escopo Prefeitura)
  3. `/faturamento/auditoria` — competência YYYY-MM · findings × CNES/INE/CNS/SIGTAP
  4. API: `GET /v1/cnes/audit?gestao=municipal` · `POST /v1/cnes/sync?gestao=municipal` · `GET /v1/faturamento/audit?competencia=2026-08&ibge=3516200`
  5. Fluxos APS/odonto/vacina/territorio/AD/lotes LEDI (inalterados)
- **API:** + módulos `cnes` e `faturamento` (audit) · demais ondas domingo intactas
- **params:** `MUNICIPIO_IBGE` · `CNES_SNAPSHOT_PATH` · `CNES_DATA_DIR` · `CNES_SYNC_ON_BOOT` · `CNES_SYNC_GESTAO` · `REQUIRE_INE_APS_OPEN` · …
- **limite documentado:** sync CNES sem PF; CNS_NOT_LINKED é quality até import PF; live CNES depende de rede; wizard LEDI não alterado; `gestao=todos` importa cidade inteira
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
| `3a44631` | Estoque/frio vacinal MVP (baixa na aplicação · estorno no void) |
| `b2928ca` | Frio/almox beyond-MVP: equipamentos · caixa térmica · leitura manual · insumos |
| `760a436` | Visita ACS lat/long MVP (RF-17.11/17.12) · OSM externo |
| `8b3de08` | AD CIAP/CID UI + preview/preflight · CIAP/CID `/atendimento` |
| `d1736e4` | CNES sync Franca + auditoria cadastro (RF-10.2 / RF-9.6) |
| `8a02ba1` | Auditoria de faturamento ficha×cadastros (RF-10.21) |
| `(pendente push)` | CNES **só rede municipal** (natureza 1244) + snapshot enriquecido + UI |

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC — reutilizar shell na Fase 2 UI
- Estoque/frio MVP + beyond-MVP — não reabrir como MVP stub
- Visita ACS registro + lat/long + OSM — não reabrir como MVP stub
- Agenda CONSULTA/ENCAIXE + grade dia
- AD CIAP/CID UI + preview
- **CNES sync + tela de auditoria + filtro gestão Prefeitura** — não reabrir como stub; próximo = lotação PF
- **Auditoria de faturamento** — não reabrir como stub (estender checks PF quando houver)

### Pendente / próximos gaps
1. Import **profissionais lotados** CNES (PF → Professional + Assignment CNS+CBO+CNES+INE)
2. Estender auditoria faturamento: profissional vs CNES municipal
3. Import dump real `TB_FAIXA_ETARIA_VACINACAO` quando disponível
4. Lote XML cadastro domiciliar e visita ACS (tipo 8) / AD — **bloqueado** até dump/TB
5. Agenda TR residual — só se TR exigir além de CONSULTA/ENCAIXE
6. Fase 2 UI Claude Design — **não** nesta fase
7. Fora APS P0: SAMU · Farmácia geral · Hospitalar

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- **Commitar** `data/cnes/franca-3516200.json` (público, sem PHI)
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC
- Após pull: `cd apps/api && npx prisma db push` (endereço Facility + `cnes`/`ine` unique + tabelas anteriores)
- Critério CNES municipal: **natureza jurídica 1244**; NÃO `tipo_gestao=M` sozinho

_Atualizado em 2026-08-16 (CNES filtro Prefeitura / natureza 1244)_

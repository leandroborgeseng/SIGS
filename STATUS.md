# STATUS — SIGS

- **etapa_atual:** Domingo APS — **Auditoria cadastro CNES** (Franca 3516200) + sync snapshot; próximo gap técnico abaixo
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + AD polish + CNES sync/audit):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP**
  - **RF-2.30 / RF-2.29 / RF-17.11–12 / RF-3.54** (CDS · domicílio · visita ACS · AD)
  - **CNES (RF-10.2 / RF-9.6):** snapshot `data/cnes/franca-3516200.json` · `POST /v1/cnes/sync` · `GET /v1/cnes/audit` · UI `/cadastros/cnes-auditoria` · sync em `/unidades`
- **como usar:**
  1. `npm run sync:cnes -- --ibge=3516200 --source=snapshot` (ou botão Sync em `/unidades`)
  2. Abrir `/cadastros/cnes-auditoria` — filtros por severidade/código · Export CSV
  3. API: `GET /v1/cnes/audit?ibge=3516200` · `POST /v1/cnes/sync?ibge=3516200&source=snapshot`
  4. Fluxos APS/odonto/vacina/territorio/AD/lotes LEDI (inalterados)
- **API:** + módulo `cnes` (sync live/snapshot + auditoria) · demais ondas domingo intactas
- **params:** `MUNICIPIO_IBGE` · `CNES_SNAPSHOT_PATH` · `CNES_DATA_DIR` · `REQUIRE_INE_APS_OPEN` · …
- **limite documentado:** sync sem profissionais lotados (PF); live depende de rede; heurística tipo equipe≠norma CNES completa; sem IoT; lote XML cadastro/visita/AD ainda não
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

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC — reutilizar shell na Fase 2 UI
- Estoque/frio MVP + beyond-MVP — não reabrir como MVP stub
- Visita ACS registro + lat/long + OSM — não reabrir como MVP stub
- Agenda CONSULTA/ENCAIXE + grade dia
- AD CIAP/CID UI + preview
- **CNES sync + tela de auditoria** — não reabrir como stub; próximo = lotação PF

### Pendente / próximos gaps
1. Import dump real `TB_FAIXA_ETARIA_VACINACAO` quando disponível
2. Lote XML cadastro domiciliar e visita ACS (tipo 8) / AD — **bloqueado** até dump/TB
3. Import **profissionais lotados** CNES (PF) após sync de estabelecimentos/equipes
4. Agenda TR residual — só se TR exigir além de CONSULTA/ENCAIXE
5. Fase 2 UI Claude Design — **não** nesta fase
6. Fora APS P0: SAMU · Farmácia geral · Hospitalar

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- **Commitar** `data/cnes/franca-3516200.json` (público, sem PHI)
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC
- Após pull: `cd apps/api && npx prisma db push` (endereço Facility + `cnes`/`ine` unique + tabelas anteriores)

_Atualizado em 2026-08-16 (onda CNES sync + auditoria)_

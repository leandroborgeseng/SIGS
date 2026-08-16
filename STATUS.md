# STATUS — SIGS

- **etapa_atual:** Domingo APS — AD CIAP/CID + preflight; próximo gap técnico abaixo
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox + visita ACS + AD polish):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP** (lote · equipamento frio · caixa térmica · leitura manual °C · insumos leves; baixa no create; void devolve)
  - **RF-2.30:** campos CDS no paciente + vínculos no GET · PATCH desativar vínculo
  - **RF-2.29 domicílio/família CDS:** `Household` / `HouseholdFamily` / `FamilyMember` · API + catálogo LEDI · UI `/territorio` aba Domicílios · resumo na ficha do paciente · seed demo
  - **RF-17.11 / RF-17.12 visita ACS:** `AcsHomeVisit` · motivos/desfecho LEDI · lat/long opcional + link OSM · API `/v1/acs-home-visits` · UI `/territorio` aba Visitas ACS
  - **RF-3.54 AD:** multi-child · **CIAP/CID UI** (`CodeSearchSelect`) · `POST …/preview` preflight · finish · mapper 1–99 · BPA qty=N · UI `/ad`
  - **RF-3.1:** CIAP/CID `CodeSearchSelect` em `/atendimento/[id]` (antes texto livre)
  - Coletivo / odontograma / agenda / wizard lote (intactos)
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · **Estoque / frio** (equipamento · caixa · leitura · insumos) · faixa etária · anular · cartão PDF
  3. `GET/POST /v1/vaccination-stock` · cold-equipment · thermal-boxes · temp-readings · supplies · supply-links · `GET /v1/catalog/vaccination`
  4. `/territorio` — microáreas · vínculos · **domicílios/famílias CDS** · **visitas ACS** (lat/long + OSM)
  5. `/pacientes/[id]` — CDS + vínculos + domicílio
  6. `/ad` — ficha multi-cidadão · CIAP/CID · Preflight → Finalizar · `/coletivo` · `/odonto/[id]` · lotes `/faturamento/lote/{fai,fao,proc}`
- **API:** vacinação + estoque/frio/insumos · patients CDS · households · **acs-home-visits** · `GET/POST /v1/home-care-visits` · `POST …/preview` · `POST/DELETE …/children` · `POST …/finish` · `GET /v1/catalog/home-care` · `GET /v1/catalog/acs-visit`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE` · `MUNICIPIO_NOME` · `SKIP_VACCINATION_CATALOG_SEED`
- **limite documentado:** sem IoT/alarmes contínuos; sem farmácia municipal geral; faixa etária seed ≠ dump TB e-SUS; sem mapa embutido (só OSM externo); lote XML cadastro domiciliar/visita ACS/AD não; agenda TR completa (cadastro livre tipos/salas) depois
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
| *(este)* | AD CIAP/CID UI + preview/preflight · CIAP/CID `/atendimento` |

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC (Safari upload, autofix chunked, PDF secretaria) — reutilizar shell na Fase 2 UI
- Estoque/frio MVP + beyond-MVP (equipamento/caixa/leitura/insumos leves) — não reabrir como MVP stub
- Visita ACS registro + lat/long + OSM — não reabrir como MVP stub (lote XML tipo 8 ainda pendente)
- Agenda CONSULTA/ENCAIXE + grade dia — não reabrir como stub de tipos item (gap TR = cadastro livre municipal)
- AD CIAP/CID UI + preview — não reabrir como “só via API”

### Pendente / próximos gaps
1. Import dump real `TB_FAIXA_ETARIA_VACINACAO` (lookup imuno+estratégia+dose) quando disponível
2. Lote XML cadastro domiciliar e visita ACS (tipo 8) / AD — **bloqueado** até dump/TB
3. Agenda TR residual (salas / grade municipal / tipos livres) — só se TR exigir além de CONSULTA/ENCAIXE
4. Fase 2 UI Claude Design — **não** nesta fase (backend-first)
5. Fora APS P0: SAMU stream · Farmácia estoque geral · Hospitalar — ver estratégia fase 1
6. IoT contínuo / alarmes geladeira — só se hardware/integração (fora do beyond-MVP atual)

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC
- Após pull: `cd apps/api && npx prisma db push` (tabelas frio/insumos vacinal + catálogo + **acs_home_visits**)

_Atualizado em 2026-08-16 (onda AD CIAP/CID + preflight)_

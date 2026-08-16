# STATUS — SIGS

- **etapa_atual:** Domingo APS — onda frio/almox beyond-MVP; próximo gap técnico abaixo
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16 + frio/almox):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas · void · PDF · UI `/vacinacao` · **estoque/frio beyond-MVP** (lote · equipamento frio · caixa térmica · leitura manual °C · insumos leves; baixa no create; void devolve)
  - **RF-2.30:** campos CDS no paciente + vínculos no GET · PATCH desativar vínculo
  - **RF-2.29 domicílio/família CDS:** `Household` / `HouseholdFamily` / `FamilyMember` · API + catálogo LEDI · UI `/territorio` aba Domicílios · resumo na ficha do paciente · seed demo
  - **RF-3.54 AD multi-child:** `childrenJson` · open `patientIds`/`children` · `POST/DELETE …/children` · mapper 1–99 · BPA qty=N · UI `/ad` · condições/tipo/local LEDI
  - Coletivo / odontograma / agenda / wizard lote (intactos)
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · **Estoque / frio** (equipamento · caixa · leitura · insumos) · faixa etária · anular · cartão PDF
  3. `GET/POST /v1/vaccination-stock` · cold-equipment · thermal-boxes · temp-readings · supplies · supply-links · `GET /v1/catalog/vaccination`
  4. `/territorio` — microáreas · vínculos · **domicílios/famílias CDS**
  5. `/pacientes/[id]` — CDS + vínculos + domicílio
  6. `/ad` — ficha multi-cidadão · `/coletivo` · `/odonto/[id]` · lotes `/faturamento/lote/{fai,fao,proc}`
- **API:** vacinação + estoque/frio/insumos · patients CDS · households · `GET/POST /v1/home-care-visits` · `POST/DELETE …/children` · `POST …/finish` · `GET /v1/catalog/home-care`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE` · `MUNICIPIO_NOME` · `SKIP_VACCINATION_CATALOG_SEED`
- **limite documentado:** sem IoT/alarmes contínuos; sem farmácia municipal geral; faixa etária seed ≠ dump TB e-SUS; GIS/lat-long domicílio não; lote XML cadastro domiciliar/AD não; agenda TR completa; CIAP/CID AD só via API/finish avançado na UI
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
| *(HEAD)* | Frio/almox beyond-MVP: equipamentos · caixa térmica · leitura manual · insumos |

### Já fechado (não reabrir nesta fase)
- Wizard lote LEDI FAI / FAO / PROC (Safari upload, autofix chunked, PDF secretaria) — reutilizar shell na Fase 2 UI
- Estoque/frio MVP + beyond-MVP (equipamento/caixa/leitura/insumos leves) — não reabrir como MVP stub

### Pendente / próximos gaps
1. Import dump real `TB_FAIXA_ETARIA_VACINACAO` (lookup imuno+estratégia+dose) quando disponível
2. GIS / visita ACS lat-long; lote XML cadastro domiciliar e AD
3. Polish gaps RF APS ainda parciais (FAI CIAP/CID UI, AD finish avançado, agenda TR)
4. Fase 2 UI Claude Design — **não** nesta fase (backend-first)
5. Fora APS P0: SAMU stream · Farmácia estoque geral · Hospitalar — ver estratégia fase 1
6. IoT contínuo / alarmes geladeira — só se hardware/integração (fora do beyond-MVP atual)

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC
- Após pull: `cd apps/api && npx prisma db push` (tabelas frio/insumos vacinal + catálogo)

_Atualizado em 2026-08-16 (onda frio/almox beyond-MVP)_

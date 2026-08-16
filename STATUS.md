# STATUS — SIGS

- **etapa_atual:** Domingo APS — estoque/cadeia de frio vacinal MVP (RF-14.3–6 / 15–19 parciais)
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI **v3 (99 imunos)** + 54 faixas · void · PDF · UI `/vacinacao` · **estoque/frio MVP** (lote/qty/°C alvo; baixa no create; void devolve)
  - **RF-2.30:** campos CDS no paciente + vínculos no GET · PATCH desativar vínculo
  - **RF-2.29 domicílio/família CDS:** `Household` / `HouseholdFamily` / `FamilyMember` · API + catálogo LEDI · UI `/territorio` aba Domicílios · resumo na ficha do paciente · seed demo
  - **RF-3.54 AD multi-child:** `childrenJson` · open `patientIds`/`children` · `POST/DELETE …/children` · mapper 1–99 · BPA qty=N · UI `/ad` · condições/tipo/local LEDI
  - Coletivo / odontograma / agenda / wizard lote (intactos)
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · **Estoque / frio** · faixa etária · anular · cartão PDF
  3. `GET/POST /v1/vaccination-stock` · `GET /v1/catalog/vaccination` (`stock` MVP)
  4. `/territorio` — microáreas · vínculos · **domicílios/famílias CDS**
  5. `/pacientes/[id]` — CDS + vínculos + domicílio
  6. `/ad` — ficha multi-cidadão · `/coletivo` · `/odonto/[id]` · lotes `/faturamento/lote/{fai,fao,proc}`
- **API:** vacinação + estoque · patients CDS · households · `GET/POST /v1/home-care-visits` · `POST/DELETE …/children` · `POST …/finish` · `GET /v1/catalog/home-care`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE` · `MUNICIPIO_NOME` · `SKIP_VACCINATION_CATALOG_SEED`
- **limite documentado:** sem IoT/monitoramento contínuo geladeira; sem equipamentos frios/caixa térmica/almoxarifado; faixa etária seed ≠ dump TB e-SUS; GIS/lat-long domicílio não; lote XML cadastro domiciliar/AD não; agenda TR completa; CIAP/CID AD só via API/finish avançado na UI
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-16)

### Entregue nesta onda
- Prisma `vaccination_stock_lots` + `vaccination_stock_movements`
- Entrada estoque; baixa no `POST /vaccinations` se lote existir; void restaura qty
- UI `/vacinacao` aba **Estoque / frio** + stub explícito do que não é
- IDs LEDI estáveis (BCG=15 etc.) preservados para lotes de produção

### Pendente / próximo gap (APS principal saturando)
1. Import dump real `TB_FAIXA_ETARIA_VACINACAO` (lookup imuno+estratégia+dose) quando disponível
2. Equipamentos frios / caixa térmica / IoT (RF-14.17–19 além da faixa declarada)
3. Almoxarifado + insumos (RF-14.4/14.6)
4. GIS/visita ACS lat-long; lote XML cadastro domiciliar e AD
5. Fase 2 UI Claude Design — **não** nesta fase
6. Fora APS P0: SAMU stream · Farmácia estoque · Hospitalar — ver estratégia fase 1

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC (Safari upload, autofix 8k, PDF secretaria)
- Após pull: `cd apps/api && npx prisma db push` (tabelas estoque vacinal)

_Atualizado em 2026-08-16 (onda estoque/frio vacinal MVP)_

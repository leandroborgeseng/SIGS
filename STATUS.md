# STATUS — SIGS

- **etapa_atual:** Domingo APS — AD multi-child LEDI (RF-3.54)
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI expandido + sync overlay · faixa etária · void · PDF cartão · UI `/vacinacao`
  - **RF-2.30:** campos CDS no paciente + vínculos no GET · PATCH desativar vínculo
  - **RF-2.29 domicílio/família CDS:** `Household` / `HouseholdFamily` / `FamilyMember` · API + catálogo LEDI · UI `/territorio` aba Domicílios · resumo na ficha do paciente · seed demo
  - **RF-3.54 AD multi-child:** `childrenJson` · open `patientIds`/`children` · `POST/DELETE …/children` · mapper 1–99 · BPA qty=N · UI `/ad` · condições/tipo/local LEDI
  - Coletivo / odontograma / agenda / wizard lote (intactos)
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · faixa etária · anular · cartão PDF
  3. `/territorio` — microáreas · vínculos · **domicílios/famílias CDS**
  4. `/pacientes/[id]` — CDS + vínculos + domicílio
  5. `/ad` — ficha multi-cidadão · `/coletivo` · `/odonto/[id]` · lotes `/faturamento/lote/{fai,fao,proc}`
- **API:** vacinação · patients CDS · households · `GET/POST /v1/home-care-visits` · `POST/DELETE …/children` · `POST …/finish` · `GET /v1/catalog/home-care`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE` · `MUNICIPIO_NOME`
- **limite documentado:** estoque/frio stub; faixa etária seed ≠ TB e-SUS; GIS/lat-long domicílio não; lote XML cadastro domiciliar/AD não; agenda TR completa; CIAP/CID AD só via API/finish avançado na UI
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-16)

### Entregue nesta onda
- AD multi-child LEDI (RF-3.54): modelo `children_json`, API add/remove child, mapper N children, BPA qty, UI `/ad`, condições avaliadas + tipo/local no catálogo
- Matriz RF + manuais atualizados

### Pendente
1. Sync DB real `TB_IMUNOBIOLOGICO` / `TB_FAIXA_ETARIA_VACINACAO` (hoje seed+overlay)
2. Estoque/frio completo (RF-14.3–6, 15–19 além do stub)
3. GIS/visita ACS lat-long; lote XML cadastro domiciliar e AD
4. Fase 2 UI Claude Design — **não** nesta fase

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC (Safari upload, autofix 8k, PDF secretaria)

_Atualizado em 2026-08-16 (onda AD multi-child RF-3.54)_

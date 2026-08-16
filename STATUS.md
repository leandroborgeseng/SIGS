# STATUS — SIGS

- **etapa_atual:** Domingo APS — domicílio/família CDS (RF-2.29)
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI expandido + sync overlay · faixa etária · void · PDF cartão · UI `/vacinacao`
  - **RF-2.30:** campos CDS no paciente + vínculos no GET · PATCH desativar vínculo
  - **RF-2.29 domicílio/família CDS:** `Household` / `HouseholdFamily` / `FamilyMember` · API + catálogo LEDI · UI `/territorio` aba Domicílios · resumo na ficha do paciente · seed demo
  - Coletivo / AD / odontograma / agenda / wizard lote (intactos)
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · faixa etária · anular · cartão PDF
  3. `/territorio` — microáreas · vínculos · **domicílios/famílias CDS**
  4. `/pacientes/[id]` — CDS + vínculos + domicílio
  5. `/coletivo` · `/ad` · `/odonto/[id]` · lotes `/faturamento/lote/{fai,fao,proc}`
- **API:** vacinação · patients CDS · `PATCH /v1/patient-team-links/:id` · `GET/POST/PATCH /v1/households` · `POST …/families` · `POST/PATCH family-members` · `GET /v1/catalog/household`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE` · `MUNICIPIO_NOME`
- **limite documentado:** estoque/frio stub; faixa etária seed ≠ TB e-SUS; multi-child AD; GIS/lat-long domicílio não; lote XML cadastro domiciliar não; agenda TR completa
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-16)

### Entregue nesta onda
- Domicílio/família CDS (resto RF-2.29 territorial): modelo Prisma + API + UI `/territorio` + seed demo + ficha paciente
- Matriz RF + manuais atualizados

### Pendente
1. Sync DB real `TB_IMUNOBIOLOGICO` / `TB_FAIXA_ETARIA_VACINACAO` (hoje seed+overlay)
2. Estoque/frio completo (RF-14.3–6, 15–19 além do stub)
3. Multi-child AD; GIS/visita ACS lat-long; lote XML cadastro domiciliar
4. Fase 2 UI Claude Design — **não** nesta fase

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC (Safari upload, autofix 8k, PDF secretaria)

_Atualizado em 2026-08-16 (onda domicílio/família CDS RF-2.29)_

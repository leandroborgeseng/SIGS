# STATUS — SIGS

- **etapa_atual:** Domingo APS — vacina catálogo/faixa/void + RF-2.30 CDS
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Ondas domingo 2026-08-16):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria → mapper · RF-3.24/3.55 parciais
  - **Vacinação:** catálogo LEDI expandido (dicionário) + sync overlay · faixa etária seed (RF-14.7/8) · void local · `lotExpiry` · PDF cartão · estoque stub · UI `/vacinacao`
  - **RF-2.30:** campos CDS no paciente + vínculos no GET · PATCH desativar vínculo · UI ficha/território
  - Coletivo / AD / odontograma / agenda / wizard lote (intactos)
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · faixa etária · anular · cartão PDF
  3. `/pacientes/[id]` — CDS + vínculos; `/territorio` — desativar vínculo
  4. `/coletivo` · `/ad` · `/odonto/[id]` · lotes `/faturamento/lote/{fai,fao,proc}`
- **API:** `GET/POST /v1/catalog/vaccination(/sync)` · `POST /v1/vaccinations` · `POST …/void` · `GET …/vaccination-card(.pdf)` · patients CDS · `PATCH /v1/patient-team-links/:id`
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE` · `MUNICIPIO_NOME`
- **limite documentado:** estoque/frio só stub; faixa etária seed ≠ TB e-SUS completa; multi-child AD; agenda TR completa; lotes XML vacina/AD/coletivo só origem nativa
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-16)

### Entregue nesta onda
- Vacina: catálogo além do seed mínimo · sync overlay · faixa etária · void · lotExpiry · stock stub
- RF-2.30: identidade Siaps mínima (CDS + vínculo equipe)
- Matriz RF + manuais atualizados

### Pendente
1. Sync DB real `TB_IMUNOBIOLOGICO` / `TB_FAIXA_ETARIA_VACINACAO` (hoje seed+overlay)
2. Estoque/frio completo (RF-14.3–6, 15–19 além do stub)
3. Domicílio/família CDS territorial rico (resto RF-2.29)
4. Fase 2 UI Claude Design — **não** nesta fase

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC (Safari upload, autofix 8k, PDF secretaria)

_Atualizado em 2026-08-16 (onda vacina + RF-2.30)_

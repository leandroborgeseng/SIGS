# STATUS — SIGS

- **etapa_atual:** Domingo APS — FAI SOAP/antropometria + vacina LEDI ids/PDF + coletivo/AD
- **entregue (A–F + odontograma + agenda grade + RF-12.13 + RF-12.11 + APS FAI + fila APS + LEDI P1 + wizard lote + Onda domingo 2026-08-16):**
  - Área `/faturamento` (hub · filas `/faturamento/odonto` e `/faturamento/aps` · sanfona **Tratamento de lotes LEDI**: FAO / FAI / Procedimentos)
  - **APS FAI Onda A:** `/aps/[id]` com SOAP + antropometria (peso/altura/PC) → mapper `medicoes`/`soap` · RF-3.24/3.55 parciais
  - **Vacinação P5:** catálogo com `lediId` (BCG=15, HB=9, …) · mapper numérico · PDF cartão (`…/vaccination-card.pdf`) · `clinical-core` tipo `VAC` · UI `/vacinacao`
  - **Coletivo:** catálogo enums LEDI completos · participantes nominais · profissional/procedimento · `/coletivo`
  - **AD:** desfecho no finish · UI `/ad`
  - Odontograma FDI · agenda APS/odonto · wizard lote FAI/FAO/PROC (não quebrar)
- **como usar:**
  1. `/aps/agenda` ou `/aps` → ficha FAI `/aps/[id]` (SOAP + medições + CIAP + condutas) → fila `/faturamento/aps`
  2. `/vacinacao` — aplicar · cartão · PDF
  3. `/coletivo` — atividade → finalizar → Produção
  4. `/ad` — visita AD1/2/3 + desfecho → finalizar
  5. `/odonto/[id]` · lotes em `/faturamento/lote/{fai,fao,proc}`
- **API:** `GET /v1/catalog/aps|vaccination|collective|home-care` · encounters FAI · `POST /v1/vaccinations` · `GET …/vaccination-card(.pdf)` · collective/home-care finish
- **params:** `REQUIRE_INE_APS_OPEN` · `APS_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE` · `MUNICIPIO_NOME`
- **limite documentado:** estoque/frio vacinal adiado; multi-child AD; agenda TR completa; lotes XML vacina/AD/coletivo só origem nativa; visita ACS lote XML adiada
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-16)

### Entregue nesta onda (domingo APS)
- FAI: SOAP + antropometria na UI `/aps/[id]` (já persistiam no draft/mapper)
- Vacina: IDs LEDI numéricos + PDF cartão + ProductionRecord nativo `VAC`
- Coletivo: enums LEDI + lista nominal + lotação na UI
- AD: desfecho no finish na UI
- Matriz RF + manuais stub atualizados

### Pendente
1. Smoke visual: `/aps/[id]` SOAP/medições → finish → fila; `/vacinacao` PDF; `/coletivo` nominal; `/ad` desfecho
2. Catálogo imunobiológicos completo (sync DB vs seed)
3. Estoque/frio/faixa etária vacina (RF-14.3–8, 15–19)
4. Cadastro individual APS RF-2.30 / território rico se bloquear qualidade Siaps
5. Fase 2 UI Claude Design — **não** nesta fase
6. Odonto residual: interrupção formal tratamento, Dentinho de Leite (só se RF explícito)

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- Não quebrar wizard lote FAI/FAO/PROC (Safari upload, autofix 8k, PDF secretaria)

_Atualizado em 2026-08-16 (ondas A–D APS domingo)_

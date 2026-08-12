# STATUS — SIGS

- **etapa_atual**: **Onda 1 atendimento odonto** (Siaps-ready na origem) + Railway/Postgres
- **como usar:**
  1. `/odonto` → abrir → `/odonto/[id]` preencher campos LEDI → Validar → Finalizar e faturar
  2. Lote XML: `/odonto/lote`
  3. Desenho: `docs/planejamento/desenho-atendimento-odontologico.md`
  4. Manual stub: `docs/manuais/usuario/odonto/atendimento-onda1.md`
- **params:** `REQUIRE_INE_DENTAL_OPEN` (Franca=true em prod) · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **adiado:** agenda/odontograma rico/prótese · Redis/worker · UI Claude Design

_Atualizado em 2026-08-12_

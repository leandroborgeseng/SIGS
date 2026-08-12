# STATUS — SIGS

- **etapa_atual**: Fila de faturamento odonto + Onda 1 atendimento + Railway
- **como usar:**
  1. `/odonto` abre atendimento → entra na fila do mês
  2. `/odonto/faturamento` — lista completa com cores do lote LEDI (blocker/money/quality/ok)
  3. `/odonto/[id]` preenche → Validar → Finalizar e faturar
  4. Lote XML: `/odonto/lote`
- **API:** `GET /v1/dental/faturamento-queue?competencia=YYYY-MM`
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`

_Atualizado em 2026-08-12_

# STATUS — SIGS

- **etapa_atual**: Stream A+B+D — rotas `/faturamento/*` + odonto (lotação · CIAP/CID · validação ao vivo · Tela C · VOID rascunho)
- **como usar:**
  1. `/odonto` — escolher paciente, profissional e **lotação/equipe** → abrir
  2. `/odonto/[id]` — preencher; painel LEDI valida ~1s após editar; Finalizar e faturar
  3. Pós-fechamento: `/faturamento/odonto` (fila) e `/faturamento/lote/fao` (XML)
  4. Anular só rascunho (`IN_PROGRESS`); VOID pós-finish = gap documentado
  5. Aliases antigos redirecionam: `/odonto/lote` → FAO, `/odonto/faturamento` → fila
- **API:** `GET /v1/dental/faturamento-queue` · `POST .../void` (rascunho)
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **gap:** VOID de atendimento já `COMPLETED` (estorno LEDI) — ver `docs/planejamento/desenho-atendimento-odontologico.md` §12

_Atualizado em 2026-08-12_

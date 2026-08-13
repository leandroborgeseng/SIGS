# STATUS — SIGS

- **etapa_atual**: Stream C — UX fila `/faturamento/odonto` (sync lote · deep-link · empty CTA)
- **como usar:**
  1. `/odonto` — escolher paciente, profissional e **lotação/equipe** → abrir
  2. `/odonto/[id]` — preencher; painel LEDI valida ~1s após editar; Finalizar e faturar
  3. Pós-fechamento (Tela C): `/faturamento/odonto?encounterId=…&batchId=…` destaca o item
  4. Fila: **Atualizar** (`forceSync`) ou **Revalidar pendências** (`POST …/sync`); empty → CTA lote FAO
  5. Lote XML: `/faturamento/lote/fao` · aliases antigos redirecionam
- **API:** `GET /v1/dental/faturamento-queue?forceSync=1` · `POST /v1/dental/faturamento-queue/sync` · `POST …/void` (rascunho)
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **gap:** VOID de atendimento já `COMPLETED` (estorno LEDI) — ver `docs/planejamento/desenho-atendimento-odontologico.md` §12

_Atualizado em 2026-08-12_

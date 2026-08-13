# STATUS — SIGS

- **etapa_atual**: Stream E — DoD docs/testes/matriz (pós A+B+C+D em `main`)
- **entregue (A–D):**
  - Área `/faturamento` (hub · fila `/faturamento/odonto` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Nav em sanfona (grupo Faturamento & Validação)
  - Gaps clínicos B: lotação na abertura, `CodeSearchSelect`, debounce ~900ms + preview FAO, Tela C
  - Fila C: deep-link `encounterId`/`batchId`, `forceSync`, revalidar pendências, empty CTA
  - Sem R$ na UI de risco (contagens `moneyRisks` / severidade LEDI)
  - Condutas = catálogo LEDI canônico (`LEDI_CONDUTA_ODONTO`)
- **como usar:**
  1. `/odonto` — paciente + profissional + **lotação/equipe** → abrir
  2. `/odonto/[id]` — seções A; painel LEDI ~1s após editar; Finalizar e faturar
  3. Tela C → `/faturamento/odonto?encounterId=…&batchId=…`
  4. Fila: **Atualizar** / **Revalidar pendências**; lote FAO: `/faturamento/lote/fao`
- **API:** `GET /v1/dental/faturamento-queue?forceSync=1` · `POST …/sync` · `POST …/void` (só rascunho)
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **gap:** VOID pós-`COMPLETED` (estorno LEDI) — desenho §12
- **deploy:** hardening Railway — fail-fast `DATABASE_URL`/`JWT_SECRET`, health `/api/health`+`/api/ready`, Redis/Bull opcional (inline), Dockerfile HEALTHCHECK
- **próximo:** smoke Railway (deploy A–D) · **Onda 2 / Stream F (Previne na origem) adiado**

_Atualizado em 2026-08-12_

# STATUS — SIGS

- **etapa_atual**: RF-12.11 histórico de odontograma (timeline + snapshot na ficha)
- **entregue (A–F + odontograma + agenda + RF-12.13 + RF-12.11):**
  - Área `/faturamento` (hub · fila `/faturamento/odonto` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao`
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit)
  - **Odontograma (RF-12.12 parcial):** grade FDI · escopos Q1–Q4 / S1–S6 / BOCA · condições · PATCH `odontogram` → LEDI
  - **Agenda odonto (RF-12.1 parcial):** `/odonto/agenda` lista do dia · criar slot · `POST /v1/appointments/:id/open-dental` → encounter com `appointmentId` · slot PRESENT · tipoAtendimento=2
  - **RF-12.13:** catálogo predefinido em `GET /v1/catalog/dental` · lista no odontograma · planejado/`done` · FAO só realizados
  - **RF-12.11:** `GET /v1/dental-encounters/:id/odontogram-history` · timeline na ficha (mesmo paciente + unidade; sem VOID)
- **como usar:**
  1. `/odonto/agenda` — dia + profissional + paciente → **Agendar** → **Abrir atendimento**
  2. `/odonto` — abertura espontânea (tipo 5) se não houver slot
  3. `/odonto/[id]` — ficha + odontograma + histórico + catálogo SIGTAP (concluir) + LEDI/Previne → Finalizar e faturar
  4. Fila / lote FAO em `/faturamento/…`
- **API:** `GET/POST /v1/appointments` · `POST …/:id/open-dental` · `GET /v1/catalog/dental` (`predefinedProcedures`) · `GET …/odontogram-history` · `POST …/void`
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** agenda sem tipos de item/grade multi-profissional (RF-12.1 TR); VOID sem recall Ministério; histórico só mesma unidade (sem RNDS/copiar snapshot); Thrift FAO sem tooth/region
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-13)

### Entregue nesta onda
- **RF-12.11** histórico de odontograma: atendimentos anteriores do mesmo paciente na unidade atual; timeline + snapshot leitura na ficha `/odonto/[id]`

### Pendente
1. Smoke visual browser: `/odonto/agenda` → abrir → ficha → odontograma Q/S + histórico + catálogo SIGTAP concluir → finalizar → fila → ZIP FAI/FAO
2. Railway: confirmar `JWT_SECRET` ok; `SEED_ADMIN_PASSWORD` ≥12 chars; smoke ZIP FAI/FAO em `/faturamento/lote/*` (multipart `/upload-zip`; Next rewrite 80mb)
3. Ficha APS origem FAI tipo 4 (paralelo ao odonto; lote `/faturamento/lote/fai` já valida XML legado)
4. LEDI P1 — campos individuais na ficha ligados ao motor `clinical-core`
5. Redis/Bull (opcional em prod — hoje opcional no boot)
6. Fase 2 UI (Claude Design) — **não** nesta fase backend-first
7. Agenda TR restante: tipos de item / grade multi-profissional
8. Histórico odonto extra: copiar snapshot para o atual; outras unidades; RNDS (RF-12.18)

### Notas handoff
- Working tree: não commitar `data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`
- Sem dados reais de pacientes
- **Hotfix prod:** entrypoint trata `prisma db push` + `--accept-data-loss` após dedupe de `appointment_id` (unique agenda odonto)

_Atualizado em 2026-08-13 (RF-12.11 histórico odontograma)_

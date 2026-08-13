# STATUS — SIGS

- **etapa_atual**: Agenda odonto MVP (RF-12.1 parcial) + odontograma (RF-12.12 parcial) — **pausado para retomar**
- **entregue (A–F + odontograma + agenda):**
  - Área `/faturamento` (hub · fila `/faturamento/odonto` · lotes `/faturamento/lote/{fao,fai,proc}`)
  - Gaps clínicos B–D: lotação, `CodeSearchSelect`, preview FAO, Tela C, fila, condutas LEDI
  - **Stream F (Previne na origem):** painel B1–B6 / qualidade em `/odonto/[id]` + `preview-fao`
  - **VOID pós-COMPLETED:** anulação local (encounter VOID + batch `error` + audit)
  - **Odontograma (RF-12.12 parcial):** grade FDI · escopos Q1–Q4 / S1–S6 / BOCA · condições · PATCH `odontogram` → LEDI
  - **Agenda odonto (RF-12.1 parcial):** `/odonto/agenda` lista do dia · criar slot · `POST /v1/appointments/:id/open-dental` → encounter com `appointmentId` · slot PRESENT · tipoAtendimento=2
- **como usar:**
  1. `/odonto/agenda` — dia + profissional + paciente → **Agendar** → **Abrir atendimento**
  2. `/odonto` — abertura espontânea (tipo 5) se não houver slot
  3. `/odonto/[id]` — ficha + odontograma + LEDI/Previne → Finalizar e faturar
  4. Fila / lote FAO em `/faturamento/…`
- **API:** `GET/POST /v1/appointments` · `POST …/:id/open-dental` · `GET /v1/catalog/dental` · `POST …/void`
- **params:** `REQUIRE_INE_DENTAL_OPEN` · `DENTAL_DEFAULT_TIPO_ATENDIMENTO=5` · `MUNICIPIO_IBGE`
- **limite documentado:** agenda sem tipos de item/grade multi-profissional (RF-12.1 TR); VOID sem recall Ministério; odontograma sem histórico/procedimentos predefinidos ricos (RF-12.13); Thrift FAO sem tooth/region
- **deploy:** hardening Railway — fail-fast env, health `/api/health`+`/api/ready`, Redis/Bull opcional
- **próximo:** ver **Retomar daqui**

## Retomar daqui (2026-08-12/13)

### Entregue hoje
- Sanfona/faturamento: hub + fila odonto + lotes FAO/FAI/PROC; CTAs ZIP e help in-app (`620620b`, `3889542`)
- Stream F Previne B1–B6 na origem + VOID local pós-COMPLETED (`e750adf`)
- Fluxo encounter → fila de faturamento (teste API `adcd9d6`)
- ZIP LEDI endurecido p/ Downloads/iCloud (`35e76c0`) — **testar FAI no Railway**
- Login seed sem credenciais embutidas em produção (`ec9c063`)
- Odontograma FDI + escopos Q/S/BOCA (`cb902f7`, `2192f3a`)
- **Agenda odonto MVP commitada** (`31995bb`): API `open-dental` + `/odonto/agenda` + schema `DentalEncounter.appointmentId` · `tsc`/testes agenda verdes · já em `origin/main`

### Pendente (amanhã)
1. Smoke visual browser: `/odonto/agenda` → abrir atendimento → ficha → odontograma Q/S → finalizar → fila → ZIP FAI/FAO
2. Railway: confirmar `JWT_SECRET` ok; `SEED_ADMIN_PASSWORD` ≥12 chars; smoke ZIP FAI após deploy com `35e76c0`+
3. RF-12.13 (procedimentos/histórico odontograma ricos)
4. Histórico de odontograma (timeline/versões)
5. Redis/Bull (opcional em prod — hoje opcional no boot)
6. Fase 2 UI (Claude Design) — **não** nesta fase backend-first
7. Agenda TR restante: tipos de item / grade multi-profissional

### Notas handoff
- Working tree limpa de código: só lixo local untracked (`data/esus`, `data/sigtap`, `sus_intelligence`, `tools/*-home`, `contexts/`) — **não commitar**
- Após pull: `prisma db push` (ou migrate) se schema local atrasado — campo `appointment_id` em `dental_encounters`
- Sem Stream novo / sem odontograma extra nesta pausa

_Atualizado em 2026-08-12 (handoff PC off)_

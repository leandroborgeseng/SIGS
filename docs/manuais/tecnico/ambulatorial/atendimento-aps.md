# Manual técnico — Atendimento APS (P4)

**Versão:** 0.4.0-dev  
**RF:** RF-3.1, RF-3.24 (Obrigatórios) + RF-10.3 / RF-10.20 / RF-2.60 na finalização  
**Fonte:** `spec/encounter` + LEDI `individual-encounter-mapping.md` + design D2/D4

## Endpoints

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/encounters/queue` | Fila ativa (ou filtro `status` / `facilityId`) |
| POST | `/api/v1/encounters` | Abre atendimento (`WAITING`); 409 se já na fila do dia |
| GET | `/api/v1/encounters/:id` | Detalhe + `clinical` |
| PATCH | `/api/v1/encounters/:id/status` | Status da fila D2 |
| PUT | `/api/v1/encounters/:id/clinical` | SOAP / CIAP / CID / antropometria |
| POST | `/api/v1/encounters/:id/finish` | Exige `outcomes[]` + lotação (CBO); gera lote LEDI v2 |
| GET | `/api/v1/ledi/enums` | Catálogo turno/tipo/conduta/local/sexo (ids 5.5.24) |

## Status da fila

`WAITING` · `INITIAL_LISTENING` · `IN_PROGRESS` · `WAITING_OBSERVATION` · `IN_OBSERVATION` · `COMPLETED` · `DID_NOT_WAIT` · `ABSCONDED`

Ativos na fila: os cinco primeiros.

## Faturamento / produção (mapper `ledi-individual-v2`)

Ao finalizar:

1. Resolve **lotação** ativa (`ProfessionalAssignment` profissional+unidade) ou `cbo` / `assignmentId` no body.  
2. Mapeia turno / tipo / local / sexo / condutas → **ids LEDI** (aliases UI: `ALTA`, `MANHA`, `UBS`, `CONSULTA`…).  
3. Cria `production_batches` `kind=individual_encounter` com `headerTransport.lotacaoFormPrincipal` = `{ profissionalCNS, cboCodigo_2002, cnes, ine }`.

Sem lotação e sem `cbo` → **400**. Cadastre em `/lotacoes`.

Marcar enviado: `POST /api/v1/production/batches/:id/mark-sent` (após preflight).

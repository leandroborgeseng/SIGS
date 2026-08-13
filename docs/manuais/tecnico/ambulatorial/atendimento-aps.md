# Manual técnico — Atendimento APS (P4)

**Versão:** 0.5.0-dev  
**RF:** RF-3.1, RF-3.24 (Obrigatórios) + RF-10.3 / RF-10.20 / RF-2.60 na finalização  
**Fonte:** `spec/encounter` + LEDI `individual-encounter-mapping.md` + design D2/D4

Duas frentes na mesma entidade `Encounter`:

| Frente | UI | Origem |
|---|---|---|
| Fila SOAP | `/atendimento` (grupo Operação) | `POST /v1/encounters` sem `faiOrigin` |
| **Ficha FAI tipo 4** | `/aps` (grupo Atendimento clínico) | `POST /v1/encounters` com `faiOrigin: true` |

Não misturar com `/odonto` (FAO tipo 5).

## Endpoints

| Método | Path | Notas |
|---|---|---|
| GET | `/api/v1/catalog/aps` | Condutas FAI (`LEDI_CONDUTA`), tipo 1/2/4/5/6, SIGTAP APS |
| GET | `/api/v1/encounters` | Lista (`facilityId`, `origin=fai`) |
| GET | `/api/v1/encounters/queue` | Fila SOAP ativa (ou filtro `status` / `facilityId`) |
| GET | `/api/v1/encounters/faturamento-queue` | Fila APS do mês (`competencia`, `facilityId`, `bucket`, `forceSync`) |
| POST | `/api/v1/encounters/faturamento-queue/sync` | Revalida pendências em lote |
| POST | `/api/v1/encounters/faturamento-queue/:id/sync` | Revalida um atendimento |
| POST | `/api/v1/encounters` | Sem `faiOrigin`: abre `WAITING` (reusa fila do dia). Com `faiOrigin`: IN_PROGRESS + lotação/INE + `ProductionBatch` draft |
| GET | `/api/v1/encounters/:id` | Detalhe + `clinical` + `care` (rascunho FAI) |
| GET | `/api/v1/encounters/:id/preview-fai` | Payload `ledi-individual-v2` + `validateFaiJson` (Siaps-ready) |
| PATCH | `/api/v1/encounters/:id/status` | Status da fila D2 |
| PUT | `/api/v1/encounters/:id/clinical` | SOAP / CIAP / CID / FAI (`tipoAtendimento`, `procedimentos`, condutas) |
| POST | `/api/v1/encounters/:id/finish` | Exige `outcomes[]` + lotação; origem FAI bloqueia se BLOCKER (`enforceFaiConformity`) |
| GET | `/api/v1/ledi/enums` | Catálogo turno/tipo/conduta/local/sexo (ids 5.5.24) |

## Status da fila

`WAITING` · `INITIAL_LISTENING` · `IN_PROGRESS` · `WAITING_OBSERVATION` · `IN_OBSERVATION` · `COMPLETED` · `DID_NOT_WAIT` · `ABSCONDED`

Ativos na fila: os cinco primeiros. Abertura FAI já entra em `IN_PROGRESS`.

## Faturamento / produção (mapper `ledi-individual-v2`)

Ao **abrir** origem FAI: cria `production_batches` `kind=individual_encounter` (`queue: true`, `fichaTipo: 4`) — mesmo gancho do odonto.

Ao **finalizar** origem FAI:

1. Resolve **lotação** (`assignmentId` no `care` / body). INE obrigatório se `REQUIRE_INE_APS_OPEN` (default = mesmo critério do odonto).
2. Mapeia tipo/local/turno numéricos LEDI, condutas `TipoEncaminhamentoIndividual`, CIAP/CID, SIGTAP.
3. `validateFaiJson` — zero BLOCKER para `status=ready`.
4. Atualiza o `ProductionBatch` existente (não cria segundo lote).

XMLs legado (upload/correção) continuam em `/faturamento/lote/fai`. Fila UI: `/faturamento/aps` (espelho de `/faturamento/odonto`; deep-link `encounterId`/`batchId`).

## Parametrização

| Env | Default Franca |
|---|---|
| `REQUIRE_INE_APS_OPEN` | `true` (cai no mesmo default de `REQUIRE_INE_DENTAL_OPEN`) |
| `APS_DEFAULT_TIPO_ATENDIMENTO` | `5` (consulta no dia) |
| `APS_DEFAULT_LOCAL` | `1` (UBS) |
| `APS_DEFAULT_TURNO` | `2` (tarde) |
| `MUNICIPIO_IBGE` | `3516200` |

Marcar enviado: `POST /api/v1/production/batches/:id/mark-sent` (após preflight).


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

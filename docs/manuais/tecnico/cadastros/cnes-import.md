# Manual técnico — Import CNES (Franca / IBGE)

**Versão:** 0.2.0-dev  
**RF:** RF-10.2 (CNES), RF-9.6 (consistência Desejável), RF-2.47 (unidades), RF-2.19 (equipes)  
**Escopo:** estabelecimentos + equipes + **auditoria de inconsistências**. **Sem** profissionais lotados (PF) e sem dados de pacientes.

## Fonte

1. **Live:** [API Dados Abertos MS](https://apidadosabertos.saude.gov.br/cnes/estabelecimentos) filtrada por `codigo_municipio` (6 dígitos = IBGE sem DV) + listagem de equipes no [CnesWeb](http://cnes2.datasus.gov.br/Mod_Ind_Equipes_Listar.asp).
2. **Snapshot versionado (offline):** `data/cnes/franca-3516200.json` — só cadastro público CNES (sem PHI).

IBGE Franca/SP: **3516200** → município CNES `351620`.

## Como rodar

```bash
# Preferência: live; se a rede falhar, cai no snapshot
npm run sync:cnes -- --ibge=3516200 --source=auto

# Só snapshot (CI / sandbox)
npm run sync:cnes -- --ibge=3516200 --source=snapshot

# Só ativos (sem unidades desabilitadas no CNES)
npm run sync:cnes -- --ibge=3516200 --source=snapshot --activeOnly

# HTTP (API no ar)
curl -X POST 'http://localhost:3001/v1/cnes/sync?ibge=3516200&source=snapshot'
curl 'http://localhost:3001/v1/cnes/audit?ibge=3516200'
```

Após alterações de schema: `cd apps/api && npx prisma db push`.

## Idempotência

| Entidade | Chave | Campos |
|---|---|---|
| `Facility` | `cnes` (unique) | nome, tipo (`typeId`), CNPJ, ativo, IBGE, endereço |
| `Team` | `ine` (unique) | nome, `teamTypeId`, vínculo `facilityId`, ativo |

Reexecutar o sync atualiza diferenças e não duplica.

## Auditoria (`GET /v1/cnes/audit`)

Retorna `findings[]` tipados + `counts` (por severidade e código).

| Código | Severidade | Check |
|---|---|---|
| `TEAM_WITHOUT_FACILITY` | error | Equipe sem estabelecimento CNES |
| `FACILITY_WITHOUT_TEAM` | warn/info | Estabelecimento sem nenhuma equipe |
| `INE_DUPLICATE` | error | INE duplicado |
| `INE_CNES_OTHER_IBGE` | error/warn | INE → CNES de outro IBGE / divergente do snapshot |
| `TEAM_FACILITY_TYPE_MISMATCH` | warn | Tipo equipe APS × tipo unidade (heurística) |
| `SNAPSHOT_INACTIVE_SIGS_ACTIVE` | warn | Inativo no snapshot, ativo no SIGS |
| `CNES_FORMAT_INVALID` | error | CNES ≠ 7 dígitos úteis |
| `FACILITY_IBGE_MISMATCH` | warn | Unidade com IBGE ≠ 3516200 |
| `PATIENT_TEAM_LINK_ORPHAN` | error/warn | Vínculo paciente-equipe órfão / equipe inativa |
| `ASSIGNMENT_INE_MISSING` | error/warn | Lotação com INE inexistente / sem INE |
| `LEDI_CNES_INE_ALERT` | info | (opcional) ProductionRecord recente com CNES/INE inconsistente |

### Heurística tipo equipe × tipo unidade

Equipes APS (`70` eSF, `71` eSB, `72` NASF, `73` eMulti, `74` eCR, `76` eAP) **não** devem estar em estabelecimento tipo `22` (consultório isolado). Compatíveis: `01`/`02` UBS/posto, `15` mista, móveis `32`/`40`/`42`, `70`–`74`, `43` policlínica.

## Endpoints

| Método | Path |
|---|---|
| `POST` | `/v1/cnes/sync?ibge=&source=auto\|live\|snapshot&activeOnly=` |
| `GET` | `/v1/cnes/audit?ibge=3516200&includeLedi=` |
| `GET` | `/v1/cnes/snapshot?ibge=` — meta do JSON versionado |
| `GET` | `/v1/cnes/status` |
| `GET` | `/v1/facilities?active=true` |
| `GET` | `/v1/teams?facilityId=` |

## UI

- `/unidades` — lista + botão **Sync CNES Franca** + atalho Auditoria
- `/cadastros/cnes-auditoria` — tabela por severidade, filtros, export CSV (menu Cadastros)

## Próximo passo

Import de **profissionais lotados** (arquivo CNES `PF` / lotação CNS+CBO+CNES+INE) — fora deste MVP.

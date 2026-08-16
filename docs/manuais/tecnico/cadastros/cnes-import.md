# Manual técnico — Import CNES (Franca / IBGE)

**Versão:** 0.1.0-dev  
**RF:** RF-2.47 (unidades), RF-2.19 (equipes)  
**Escopo:** estabelecimentos + equipes. **Sem** profissionais lotados (PF) e sem dados de pacientes.

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
curl -X POST 'http://localhost:3001/v1/cnes/sync?ibge=3516200&source=auto'
```

Após alterações de schema: `cd apps/api && npx prisma db push`.

## Idempotência

| Entidade | Chave | Campos |
|---|---|---|
| `Facility` | `cnes` (unique) | nome, tipo (`typeId`), CNPJ, ativo, IBGE, endereço |
| `Team` | `ine` (unique) | nome, `teamTypeId`, vínculo `facilityId`, ativo |

Reexecutar o sync atualiza diferenças e não duplica.

## Endpoints

| Método | Path |
|---|---|
| `POST` | `/v1/cnes/sync?ibge=&source=auto\|live\|snapshot&activeOnly=` |
| `GET` | `/v1/cnes/status?ibge=` — caminho do snapshot |
| `GET` | `/v1/cnes/audit?ibge=` — inconsistências CNES/INE (cadastro × snapshot) |
| `GET` | `/v1/facilities?active=true&ibge=3516200` |
| `GET` | `/v1/teams?facilityId=` |

Sync e audit exigem permissão de organização (`ORG`).

## UI

`/unidades` — lista (filtro ativos) + botão **Sync CNES**.

## Próximo passo

Import de **profissionais lotados** (arquivo CNES `PF` / lotação CNS+CBO+CNES+INE) — fora deste MVP.

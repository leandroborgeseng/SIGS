# Manual técnico — Import CNES (Franca / IBGE)

**Versão:** 0.4.0-dev  
**RF:** RF-10.2 (CNES), RF-9.6 (consistência Desejável), RF-2.47 (unidades), RF-2.19 (equipes), RF-10.21 (auditoria faturamento)  
**Escopo default:** **rede municipal (gestão Prefeitura de Franca)** — estabelecimentos + equipes + auditoria. **Sem** profissionais lotados (PF) e sem dados de pacientes.

## Critério de filtro (oficial)

| Campo API Dados Abertos | Uso |
|---|---|
| `descricao_natureza_juridica_estabelecimento` = **1244** (Município) | **Critério principal** — bate 100% com razão social Prefeitura/Município de Franca |
| `tipo_gestao` / esfera MUNICIPAL | **Não usar sozinho** — ~1334/1346 CNES da cidade ficam `M` (particulares inclusos) |
| `nome_razao_social` contendo Prefeitura/Município | Confirmação / fallback de snapshot antigo |

Decisão de produto: importar e auditar **somente** a rede da Prefeitura (faturamento/procedimentos municipais), não particulares nem estadual/federal.

Contagens Franca (snapshot regenerado):

| Escopo | Estabelecimentos | Equipes | Ativos (est.) |
|---|---:|---:|---:|
| Cidade (IBGE 3516200) | 1346 | 124 | 545 |
| Rede municipal (1244) | **66** | **123** | **59** |

## Fonte

1. **Live:** [API Dados Abertos MS](https://apidadosabertos.saude.gov.br/cnes/estabelecimentos) filtrada por `codigo_municipio` (6 dígitos = IBGE sem DV) + listagem de equipes no [CnesWeb](http://cnes2.datasus.gov.br/Mod_Ind_Equipes_Listar.asp).
2. **Snapshot versionado (offline):** `data/cnes/franca-3516200.json` — cidade completa enriquecida (`naturezaJuridica`, `tipoGestao`, `municipalNetwork`) + meta com contagens cidade/municipal. Incluído na **imagem Docker**.

IBGE Franca/SP: **3516200** → município CNES `351620`.

## Como rodar

```bash
# Default: só rede municipal (Prefeitura)
npm run sync:cnes -- --ibge=3516200 --source=snapshot
npm run sync:cnes -- --ibge=3516200 --source=snapshot --gestao=municipal

# Cidade inteira (particulares + estadual + municipal)
npm run sync:cnes -- --ibge=3516200 --source=snapshot --gestao=todos
# ou
npm run sync:cnes -- --ibge=3516200 --source=snapshot --todos

# Live (rede); se falhar, cai no snapshot
npm run sync:cnes -- --ibge=3516200 --source=auto

# HTTP
curl -X POST 'http://localhost:3001/v1/cnes/sync?ibge=3516200&source=snapshot&gestao=municipal'
curl -X POST 'http://localhost:3001/v1/cnes/sync?ibge=3516200&source=snapshot&gestao=todos'
curl 'http://localhost:3001/v1/cnes/audit?ibge=3516200&gestao=municipal'
curl 'http://localhost:3001/v1/faturamento/audit?competencia=2026-08&ibge=3516200&gestao=municipal'
```

Variáveis: `CNES_SYNC_ON_BOOT=1` · `CNES_SYNC_GESTAO=municipal|todos` · `CNES_SNAPSHOT_PATH` · `CNES_DATA_DIR` · `MUNICIPIO_IBGE=3516200`.

## Idempotência

| Entidade | Chave | Campos |
|---|---|---|
| `Facility` | `cnes` (unique) | nome, tipo (`typeId`), CNPJ, ativo, IBGE, endereço |
| `Team` | `ine` (unique) | nome, `teamTypeId`, vínculo `facilityId`, ativo |

Reexecutar o sync atualiza diferenças e não duplica. Equipes cujo CNES não está no filtro municipal são **ignoradas** (ex.: Penitenciária estadual).

## Auditoria CNES (`GET /v1/cnes/audit`)

Default `gestao=municipal`: snapshot e findings usam só a rede Prefeitura. Retorna `gestao`, `gestaoCriterion`, contagens filtradas vs cidade.

## Auditoria faturamento (`GET /v1/faturamento/audit`)

Default `gestao=municipal`: índice CNES/INE só da rede Prefeitura (produção de particular não “passa” como CNES municipal válido).

## Endpoints

| Método | Path |
|---|---|
| `POST` | `/v1/cnes/sync?ibge=&source=&gestao=municipal\|todos&somentePrefeitura=&activeOnly=` |
| `GET` | `/v1/cnes/audit?ibge=3516200&gestao=municipal` |
| `GET` | `/v1/cnes/snapshot?ibge=` — meta + contagens cidade/municipal |
| `GET` | `/v1/cnes/status` |
| `GET` | `/v1/faturamento/audit?competencia=&ibge=&gestao=municipal` |

## UI

- `/unidades` — **Sincronizar rede municipal** + contagens filtradas
- `/cadastros/cnes-auditoria` — escopo Prefeitura + snapshot filtrado vs cidade
- `/faturamento/auditoria` — escopo CNES municipal no cabeçalho

## Próximo passo

Import de **profissionais lotados** (arquivo CNES `PF` / lotação CNS+CBO+CNES+INE) — fora deste MVP.

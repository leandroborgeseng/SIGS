# Manual técnico — Import CNES (Franca / IBGE)

**Versão:** 0.4.0-dev  
**RF:** RF-10.2 (CNES), RF-9.6 (consistência Desejável), RF-2.47 (unidades), RF-2.19 (equipes), RF-10.21 (auditoria faturamento)  
**Escopo default:** **rede municipal (gestão Prefeitura de Franca)** — estabelecimentos + equipes + **profissionais lotados (PF)** + auditoria. Sem CPF e sem dados de pacientes.

## Critério de filtro (oficial)

| Critério | Uso |
|---|---|
| `descricao_natureza_juridica_estabelecimento` = **1244** (Município) | **Critério principal** — bate 100% com razão social Prefeitura/Município de Franca |
| CNPJ mantenedora **47.970.769/0001-04** (`47970769000104`) | **Alinhado / enriquecimento** — portal Prefeitura. No snapshot CNES, `numero_cnpj` dos 66 est. 1244 vem **nulo**; o sync grava o CNPJ oficial da mantenedora. API: `?cnpj=prefeitura` ou `?cnpj=47970769000104` |
| `tipo_gestao` / esfera MUNICIPAL | **Não usar sozinho** — ~1334/1346 CNES da cidade ficam `M` (particulares inclusos) |
| `nome_razao_social` contendo Prefeitura/Município | Confirmação / fallback de snapshot antigo |

Decisão de produto: importar, listar e auditar **somente** a rede da Prefeitura (faturamento/procedimentos municipais), não particulares nem estadual/federal.

Contagens Franca (snapshot regenerado):

| Escopo | Estabelecimentos | Equipes | Ativos (est.) |
|---|---:|---:|---:|
| Cidade (IBGE 3516200) | 1346 | 124 | 545 |
| Rede municipal (1244) | **66** | **123** | **59** |

### Lista UI `/unidades` e `GET /v1/facilities`

| Query | Comportamento |
|---|---|
| *(default)* `gestao=municipal` | Rede Prefeitura (~59 ativas) — **não** cidade inteira |
| `gestao=todos` | Todos CNES do IBGE (~545 ativas) |
| `cnpj=prefeitura` / `47970769000104` | Mesmo escopo mantenedora (alinhado a 1244) |
| `active=true` | Só ativos |

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
curl -X POST 'http://localhost:3001/v1/cnes/sync-professionals?ibge=3516200'
curl 'http://localhost:3001/v1/cnes/audit?ibge=3516200&gestao=municipal'
curl 'http://localhost:3001/v1/faturamento/audit?competencia=2026-08&ibge=3516200&gestao=municipal'
```

### Profissionais lotados (PF)

Snapshot `data/cnes/franca-3516200-professionals.json` (503 profissionais / 742 lotações — CnesWeb por equipe municipal). Campos: nome + CNS + CBO + CNES + INE (cadastro público CNES).

```bash
# após sync de unidades/equipes
npm run sync:cnes -- --professionals --ibge=3516200
```

UI: **Importar profissionais lotados** em `/cadastros/cnes-auditoria`. Composição das equipes (membros + multi-equipe): **`/equipes`** (`GET /v1/cnes/teams`, `/v1/cnes/teams/:id`, `/v1/cnes/multi-team`).

Variáveis: `CNES_SYNC_ON_BOOT=1` · `CNES_SYNC_GESTAO=municipal|todos` · `CNES_SNAPSHOT_PATH` · `CNES_DATA_DIR` · `MUNICIPIO_IBGE=3516200`.

## Idempotência

| Entidade | Chave | Campos |
|---|---|---|
| `Facility` | `cnes` (unique) | nome, tipo (`typeId`), CNPJ, ativo, IBGE, endereço |
| `Team` | `ine` (unique) | nome, `teamTypeId`, vínculo `facilityId`, ativo |

Reexecutar o sync atualiza diferenças e não duplica. Equipes cujo CNES não está no filtro municipal são **ignoradas** (ex.: Penitenciária estadual).

## Auditoria CNES (`GET /v1/cnes/audit`)

Default `gestao=municipal`: snapshot e findings usam só a rede Prefeitura. Retorna `gestao`, `gestaoCriterion`, contagens filtradas vs cidade.

Cada finding inclui (quando resolvido): `facilityName`, `teamName`, `entityHref` (deep-link UI), `demoSeed` (CNES `9999999` / INE `0000000001`).

UI `/cadastros/cnes-auditoria`: glossário de colunas/códigos; links CNES→`/unidades?cnes=`, INE→`/equipes/[id]` ou `?ine=`, assignment→`/lotacoes?assignmentId=`.

## Auditoria faturamento (`GET /v1/faturamento/audit`)

Default `gestao=municipal`: índice CNES/INE só da rede Prefeitura (produção de particular não “passa” como CNES municipal válido).

## UI

- `/unidades` — default **Rede Prefeitura (mantenedora)** (~59 ativas); toggle **Todos IBGE**; sync municipal; deep-link `?cnes=` / `?id=`
- `/cadastros/cnes-auditoria` — escopo Prefeitura + glossário + deep-links findings
- `/equipes` — deep-link `?ine=` / `?q=`; detalhe `/equipes/[id]`
- `/lotacoes` — highlight `?assignmentId=`
- `/faturamento/auditoria` — escopo CNES municipal no cabeçalho

## Endpoints

| Método | Path |
|---|---|
| `GET` | `/v1/facilities?ibge=3516200&gestao=municipal\|todos&cnpj=prefeitura&active=true` |
| `POST` | `/v1/cnes/sync?ibge=&source=&gestao=municipal\|todos&somentePrefeitura=&activeOnly=` |
| `GET` | `/v1/cnes/audit?ibge=3516200&gestao=municipal` |
| `GET` | `/v1/cnes/snapshot?ibge=` — meta + contagens cidade/municipal |
| `GET` | `/v1/cnes/status` |
| `GET` | `/v1/faturamento/audit?competencia=&ibge=&gestao=municipal` |

## Próximo passo

Agenda municipal salas stub / inventário Claude Design — opcional. PF (profissionais) já disponível via `POST /v1/cnes/sync-professionals`.

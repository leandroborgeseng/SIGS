# JARs relevantes e arquitetura Bridge/PEC

**Atualizado:** 2026-08-10  
**Fonte:** inventário `03-jar-classification.csv`, `05-relevant-jars.txt`

## Contagens

| Métrica | Valor |
|---|---|
| JARs únicos | 492 |
| Relevantes P0/P1/ESUS* | ~67 |
| Classes em JARs relevantes | ~27 055 |
| Packages | ~3 604 |
| Resources indexados | ~5 547 |
| Arquivos SQL | 750 |

## Camadas observadas

```text
esus.web / cds.presentation / core.view / st10-fw-*
        ↓
cds.service.* / pec.business.impl / core.business.* / backend
        ↓
cds.common.api / pec.common.api / model / validation / metafy
        ↓
cds.persistence.* / pec.persistence / data / core.persistence
        ↓
database (Liquibase) + PostgreSQL/Oracle

Integração paralela:
  pec-ledi-thrift / ras.transport / sync-* / transport.*
  ws-client-pix / ws-client-pdq / mpi-client / unificacao
```

Packages dominantes: `br.ufsc.bridge.*`, `br.gov.saude.esus.*`, `br.gov.esus.*`.

## JARs P0 (alta prioridade para decompilação)

### Domínio / regras

- `model-5.5.24.jar`
- `cds.common.api-5.5.24.jar`
- `cds.service.api-5.5.24.jar` / `cds.service.impl-5.5.24.jar`
- `cds.extension.impl-5.5.24.jar`
- `pec.common.api-5.5.24.jar` / `pec.business.impl-5.5.24.jar`
- `core.business.*` / `core.common` / `core.validation` / `core.presenter.impl`
- `backend-5.5.24.jar`
- `validation-1.4.15.jar` / `metafy-0.2.0.jar`
- `unificacao-5.5.24.jar`

### Persistência / schema

- `database-5.5.24.jar` (Liquibase — ouro para modelo de dados)
- `data-5.5.24.jar`
- `pec.persistence-5.5.24.jar`
- `cds.persistence.impl.jpa-5.5.24.jar`
- `cds.persistence.querydslsql-5.5.24.jar`
- `core.persistence.impl-5.5.24.jar`

### LEDI / sync / transport

- `pec-ledi-thrift-6.2.10.jar`
- `sync-common-protocol-thrift-5.2.8.jar`
- `sync-common-protocol-ad-thrift-5.2.8.jar`
- `sync-common-api*-5.2.8.jar`
- `pec.transport.business.impl-5.5.24.jar`
- `ras.transport-5.5.24.jar`
- `transport.*.jar`

### Integrações externas

- `ws-client-pix-1.11.jar` (CadSUS PIX)
- `ws-client-pdq-1.10.jar` (CadSUS PDQ)
- `mpi-client-1.5.jar`

### Frontend (contexto de telas — não copiar UI)

- `esus.web-5.5.24.jar`
- `cds.presentation.*` / `pec.presentation.impl`
- `st10-fw-*` (framework UI Bridge — P1)

### Relatórios (P1)

- `report.*-5.5.24.jar`, `core.report.api-5.5.24.jar`

## Falso positivo corrigido

- `batik-bridge-*` = Apache Batik (SVG), **não** Bridge/UFSC. Classificado como THIRD_PARTY.

## Decompilação seletiva padrão

Script: `./scripts/decompile-esus.sh`  
Lista padrão: `./scripts/decompile-esus.sh --list`

Saída: `data/esus/5.5.24/decompiled/raw/<jar-sem-.jar>/`

## Exemplos já observados (só por nome de classe)

### Vacinação

- `FichaVacinacaoService` / `FichaVacinacaoServiceImpl`
- `RegraVacinalValidator`, `VacinaRowItemValidator`
- Thrift: `FichaVacinacaoChildThrift`, `FichaVacinacaoMasterThrift`

### Cidadão

- `CidadaoService`
- `CidadaoVinculacaoEquipeTransportService`
- Validadores de cadastro individual / identificação / saída do cidadão

Lista completa candidata: `06-relevant-classes.txt`.

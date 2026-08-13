# Validação LEDI FAO — conformidade odonto → Siaps / RNDS

**Versão:** 0.1.0-dev  
**RF:** RF-12.2–12.9, RF-12.16, RF-10.3, RF-10.7 (canal), RF-10.20  
**Fonte regras:** dicionário LEDI *Ficha de Atendimento Odontológico Individual* (Bridge UFSC) + Portaria GM/MS 10.192/2026

## Canal oficial (não confundir)

```text
Ficha FAO (XML ou Thrift LEDI)
  → PEC e-SUS APS / integração LEDI
  → Siaps (produção odonto APS + CEO/LRPD)
  → RNDS (granularidade / interoperabilidade)
```

- **Bundle FHIR RIA** (RF-10.7) é **outro** artefato. O endpoint de validação odonto rejeita FHIR com `FORMAT_FHIR_NOT_FAO`.
- Sistemas terceiros: `tpCdsOrigem = 3`.

## API

| Método | Path | Body |
|---|---|---|
| `POST` | `/v1/dental/ledi/validate-xml` | `{ "xml": "..." }` **ou** `{ "master": {…} }` |
| `POST` | `/v1/dental/ledi/batches` | `{ name?, files: [{ name, xml }], expectedTipo? }` |
| `POST` | `/v1/dental/ledi/batches/upload` | multipart `files` (XML) + `expectedTipo` — **não** setar `Content-Type` no fetch |
| `POST` (PUT compat) | `/v1/dental/ledi/batches/upload-zip/chunk` | **preferido na UI:** corpo `application/octet-stream` (fatia **512 KiB**) + query `uploadId`, `index`, `total`, `fileName`, `expectedTipo`, `totalBytes`. Junta em disco; última fatia ingere o ZIP (job async se ≥1500 XMLs). |
| `POST` | `/v1/dental/ledi/batches/upload-zip` | multipart `file` (.zip) — legado; o gateway Railway costuma truncar ZIPs ~14 MB |
| `POST` | `/v1/dental/ledi/batches/from-zip` | `{ zipBase64 }` — fallback legado |
| `GET` | `/v1/dental/ledi/batches` | lista lotes |
| `GET` | `/v1/dental/ledi/batches/:id` | resumo + topCodes |
| `GET` | `/v1/dental/ledi/batches/:id/items` | `?status=&code=&bucket=&q=&offset=&limit=` |
| `GET` | `/v1/dental/ledi/batches/:id/items/:itemId` | findings + XML atual |
| `PATCH` | `/v1/dental/ledi/batches/:id/items/:itemId` | campos de correção / xml |
| `POST` | `/v1/dental/ledi/batches/:id/auto-fix` | aplica correções e revalida |
| `POST` | `/v1/dental/ledi/batches/:id/dry-run` | **simula** auto-fix (não grava) — impacto de códigos |
| `GET` | `/v1/dental/ledi/batches/:id/closure-report` | relatório de fechamento (JSON + `markdown`) |
| `GET` | `/v1/dental/ledi/batches/:id/export.zip` | ZIP dos XMLs (`?mode=current\|conformant`) |
| `GET` | `/v1/catalog/dental` | catálogo vigilância / condutas / tipoAtendimento |
| `POST` | `/v1/dental-encounters/:id/finish` | exige `vigilanciaSaudeBucal[]` + `problemasCondicoes[]`; `enforceFaoConformity` (default true) |

Telas: `/faturamento/lote/fao` (FAO) · `/faturamento/lote/fai` (FAI) · `/faturamento/lote/proc` (PROC) · `/faturamento/odonto` (fila). Aliases 308: `/odonto/lote`, `/aps/lote`, `/procedimentos/lote`, `/odonto/faturamento`.

Resposta do validador:

- `conformant` — sem `BLOCKER` e sem `MONEY_RISK`
- `findings[]` — `code`, `severity`, `field`, `rule`, `rndsImpact`
- `channel` = `LEDI_FAO_SIAPS_RNDS`

## Críticas bloqueantes (amostra)

| Código | Regra |
|---|---|
| `CBO_NOT_ODONTO` | CBO fora da Tabela 4 FAO |
| `CPF_CNS_BOTH` | CPF e CNS juntos |
| `VIGILANCIA_MISSING` | FAO#10 / RF-12.7 |
| `PROBLEMAS_MISSING` | FAO#26 |
| `ALTA_EPISODIO_RULE` / `TRATAMENTO_CONCLUIDO_RULE` | FAO#8 × tiposConsulta |
| `PROC_ESCUTA_FORBIDDEN` | não usar 0301040079 como procedimento |
| `GESTANTE_SEXO_MASC` | FAO#4 |

## UI

- `/odonto` — atendimento clínico; finish envia campos críticos.
- `/faturamento/lote/fao` — upload em lote (ZIP em fatias octet-stream `/upload-zip/chunk`; XML em `/upload`), inconsistências, auto-correção (`stNaoPossuiCpf` / INE) e edição manual (CIAP/CID, consulta); download ZIP.

Deploy: `docs/planejamento/deploy-railway-coolify.md`.

## Fixture

`data/esus/5.5.24/fixtures/ledi/fao-nao-conforme.xml` — XML propositalmente inválido para testes.

## Teste de faturamento / produção

1. Lotação com CBO odonto (ex. `223208`) + IBGE na unidade.  
2. Paciente com CPF **ou** CNS válido.  
3. Finish com vigilância + CIAP/CID.  
4. Preflight sem `DENTAL_VIGILANCIA` / `DENTAL_PROBLEMAS`.  
5. Opcional: validar `payloadJson` via `POST .../validate-xml` com `{ master }`.

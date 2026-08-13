# Manual técnico — LEDI odonto / AD / coletivo

**Versão:** 0.1.0-dev  
**RF:** RF-12.1, RF-12.11, RF-12.13, RF-3.54, RF-3.53, RF-10.3, RF-10.20, RF-2.60

## Finish

| Fluxo | Kind lote | Mapper |
|---|---|---|
| Odonto | `dental_encounter` | `ledi-dental-v2` + validador FAO |
| AD | `home_care` | `ledi-homecare-v2` |
| Coletivo | `collective_activity` | `ledi-collective-v2` |

Odonto exige **lotação**, **vigilanciaSaudeBucal[]**, **problemasCondicoes[]** e emite `headerTransport.lotacaoFormPrincipal`.  
Catálogo RF-12.13: `GET /v1/catalog/dental` → `predefinedProcedures`. Só procedimentos com `done !== false` entram em `procedimentosRealizados` (FAO).  
Histórico RF-12.11: `GET /v1/dental-encounters/:id/odontogram-history` — odontogramas anteriores do mesmo paciente na mesma unidade (`status ≠ VOID`, cap 50). Snapshot de leitura; não altera o atendimento atual.  
Validação XML/JSON: `POST /v1/dental/ledi/validate-xml` — ver `ledi-fao-rnds-validacao.md`.

## Aliases UI → id

| Área | Exemplo | id |
|---|---|---|
| Odonto conduta | `ALTA` | 17 |
| AD modalidade | `AD2` | 2 |
| AD desfecho | `PERMANENCIA` | 7 |
| Coletivo tipo | `EDUCACAO_SAUDE` | 4 |
| Público | `COMUNIDADE` | 1 |

Catálogo completo: `GET /v1/ledi/enums`.

## Teste de faturamento

1. Lotação ativa em `/lotacoes`.  
2. Finalizar odonto/AD/coletivo.  
3. Preflight sem `CBO_MISSING`.  
4. BPA stub com CBO/CNS do header.

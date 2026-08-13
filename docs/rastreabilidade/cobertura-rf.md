# Cobertura RF — rastreabilidade

**CSV completo:** [cobertura-rf.csv](cobertura-rf.csv)
**Total linhas:** 599 · **cobertos:** 9 · **parciais:** 37 · **adiados:** 114 · **backlog SAMU:** 30 (não iniciado / onda `samu-backlog`)

Legenda status: `coberto` = escopo Onda 1/código atual atende o RF mínimo com evidência; `parcial` = há código mas falta fatia TR/e-SUS. Não inventar cobertura.

Estratégia: [estrategia-reescrita-fase1.md](../planejamento/estrategia-reescrita-fase1.md)

## Onda P0–P6 por módulo

| Módulo | RF | Obrig. | Desej. | Tocados |
|---|---:|---:|---:|---:|
| 1. Especificações Gerais do Sistema | 50 | 39 | 11 | 3 |
| 2. Módulo de Cadastros | 59 | 58 | 1 | 7 |
| 3. Módulo Ambulatorial | 73 | 63 | 10 | 2 |
| 10. Módulo de Integração com o e-SUS | 20 | 20 | 0 | 2 |
| 12. Módulo de Odontologia | 20 | 20 | 0 | 14 |
| 14. Módulo de Vacinação | 19 | 16 | 3 | 4 |

## Implementados / parciais (amostra)

| ID | Tipo | Status | Fat. | Código |
|---|---|---|---|---|
| RF-1.2 | Obr | parcial | n/a | `apps/api/src/auth` |
| RF-1.4 | Obr | parcial | n/a | `apps/api/src/auth#users` |
| RF-1.14 | Obr | parcial | n/a | `apps/api/.../audit + auth` |
| RF-2.2 | Obr | parcial | n/a | `apps/api/src/organization#professionals` |
| RF-2.17 | Obr | parcial | n/a | `apps/api/src/appointments` |
| RF-2.19 | Obr | parcial | n/a | `apps/api/src/organization#teams` |
| RF-2.27 | Obr | parcial | n/a | `apps/api/src/patients` (+ PATCH + UI) |
| RF-2.29 | Obr | parcial | n/a | `apps/api/src/territory` + UI `/territorio` |
| RF-2.47 | Obr | parcial | n/a | `facilities` + IBGE + UI `/unidades` |
| RF-2.56 | Obr | parcial | n/a | `apps/api/src/patients#search` + UI |
| RF-3.1 | Obr | parcial | n/a | `apps/api/src/encounters` |
| RF-3.24 | Obr | parcial | automatizado | `apps/api/src/encounters#clinical` |
| RF-10.3 | Obr | parcial | automatizado | mapper LEDI v2 + lotação + `/ledi/enums` + UI `/producao` |
| RF-10.20 | Obr | parcial | automatizado | preflight + `POST /production/send` + UI `/producao` |
| RF-14.1 | Obr | parcial | automatizado | `apps/api/src/vaccinations` |
| RF-14.2 | Obr | parcial | n/a | cartão vacinal UI + API |
| RF-12.2 | Obr | coberto | automatizado | lotação/`assignmentId` na abertura `/odonto` + header LEDI |
| RF-12.3 | Obr | coberto | automatizado | paciente na abertura + identificação na ficha |
| RF-12.5 | Obr | coberto | automatizado | `tipoAtendimento` (default 5) + UI select |
| RF-12.6 | Obr | coberto | automatizado | `tiposEncamOdonto` = `LEDI_CONDUTA_ODONTO` (UI + lote) |
| RF-12.7 | Obr | coberto | automatizado | vigilância + finish/`validateFaoJson` + preview; aviso Previne 99 (não BLOCKER) |
| RF-12.8 | Obr | coberto | previsto | `tiposFornecimOdonto` UI + mapper |
| RF-12.9 | Obr | coberto | previsto | anamnese texto livre Onda 1 |
| RF-12.1 | Obr | parcial | automatizado | `/odonto/agenda` · `POST /v1/appointments/:id/open-dental` · `DentalEncounter.appointmentId` · tipoAtendimento=2; sem grade/tipos de item TR |
| RF-12.4 | Obr | parcial | previsto | início tratamento (status/campo; sem fluxo rico) |
| RF-12.16 | Obr | parcial | automatizado | problemas CIAP/CID (`CodeSearchSelect`); patologias ricas depois |
| RF-12.12 | Obr | parcial | automatizado | odontograma FDI + Q1–Q4 / S1–S6 / BOCA em `/odonto/[id]` · `odontogramJson` · proc. `tooth`\|`region` → mapper; gap: Thrift FAO sem tooth/region |
| RF-12.11 | Obr | coberto | n/a | `GET /v1/dental-encounters/:id/odontogram-history` · timeline na ficha `/odonto/[id]` (mesmo paciente + unidade; sem VOID; snapshot leitura) |
| RF-12.13 | Obr | coberto | automatizado | catálogo predefinido `GET /v1/catalog/dental#predefinedProcedures` · PATCH lista + `done` · FAO só `done !== false` · UI `/odonto/[id]` |
| RF-12.20 | Obr | parcial | previsto | lista `/odonto` cronológica básica |
| RF-3.54 | Obr | parcial | automatizado | `ledi-homecare-v2` + UI `/ad` |
| RF-3.53 | Obr | parcial | automatizado | `ledi-collective-v2` + UI `/coletivo` |
| RF-9.2 | Obr | parcial | previsto | BPA stub via produção |
| RF-10.4 | Obr | parcial | automatizado | `bpa-stub.mapper` + `/production/bpa/export` |
| RF-10.1 | Obr | parcial | previsto | seed expandido (~27) + `/sigtap` + `import-ms` |
| RF-9.1 | Obr | parcial | automatizado | `POST /sigtap/import` + `import-ms` (TB_PROCEDIMENTO) |
| RF-9.5 | Obr | parcial | automatizado | validate + enrich BPA |
| RF-3.10 | Obr | parcial | n/a | `queue` painel + UI `/painel` |
| RF-3.11 | Obr | parcial | n/a | totem emit + UI `/totem` |
| RF-3.23 | Obr | parcial | n/a | guichê call-next + UI `/guiche` |
| RF-2.11 | Obr | parcial | n/a | `catalog/medications` + `prescription-params` |
| RF-3.33 | Obr | parcial | previsto | `prescriptions` + UI clínica/`/prescricoes` |
| RF-3.67 | Obr | parcial | previsto | `POST .../prescriptions/:id/issue` + impressão |
| RF-2.3 | Obr | parcial | n/a | `RegulationComplex` seed CRM-FRANCA |
| RF-3.52 | Obr | parcial | previsto | `regulation` + UI `/regulacao` |
| RF-3.59 | Obr | parcial | n/a | alerta `offProtocol` na solicitação |
| RF-13.2 | Obr | parcial | n/a | `RegulationProcedure` seed |
| RF-13.4 | Obr | parcial | n/a | fila `/regulacao` |
| RF-13.8 | Obr | parcial | n/a | authorize/deny/return/close |
| RF-2.60 | Obr | parcial | n/a | `assignments` + UI `/lotacoes` + header LEDI + escolha na abertura `/odonto` |
| RF-5.* | Obr/Des | não iniciado | n/a | backlog SAMU — `Samu/` · doc 12 |
| RF-16.1 | Obr | parcial | n/a | `apps/api/src/reports` |
| RF-16.7 | Obr | parcial | n/a | `apps/api/src/reports#vaccinations` |

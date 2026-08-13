# Cobertura RF — rastreabilidade

**CSV completo:** [cobertura-rf.csv](cobertura-rf.csv)
**Total linhas:** 599 · **implementados:** 0 · **parciais:** 36 · **adiados:** 114 · **backlog SAMU:** 30 (não iniciado / onda `samu-backlog`)

Estratégia: [estrategia-reescrita-fase1.md](../planejamento/estrategia-reescrita-fase1.md)

## Onda P0–P6 por módulo

| Módulo | RF | Obrig. | Desej. | Tocados |
|---|---:|---:|---:|---:|
| 1. Especificações Gerais do Sistema | 50 | 39 | 11 | 3 |
| 2. Módulo de Cadastros | 59 | 58 | 1 | 7 |
| 3. Módulo Ambulatorial | 73 | 63 | 10 | 2 |
| 10. Módulo de Integração com o e-SUS | 20 | 20 | 0 | 2 |
| 12. Módulo de Odontologia | 20 | 20 | 0 | 0 |
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
| RF-12.1 | Obr | parcial | automatizado | `ledi-dental-v2` + UI `/odonto` (lotação, CIAP/CID, preview ao vivo, Tela C; VOID só rascunho) |
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

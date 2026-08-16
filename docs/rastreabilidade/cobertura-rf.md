# Cobertura RF — rastreabilidade

**CSV completo:** [cobertura-rf.csv](cobertura-rf.csv)
**Total linhas:** 599 · **cobertos:** 9 · **parciais:** 43 · **adiados:** 114 · **backlog SAMU:** 30 (não iniciado / onda `samu-backlog`)

Legenda status: `coberto` = escopo Onda 1/código atual atende o RF mínimo com evidência; `parcial` = há código mas falta fatia TR/e-SUS. Não inventar cobertura.

Estratégia: [estrategia-reescrita-fase1.md](../planejamento/estrategia-reescrita-fase1.md)

## Onda P0–P6 por módulo

| Módulo | RF | Obrig. | Desej. | Tocados |
|---|---:|---:|---:|---:|
| 1. Especificações Gerais do Sistema | 50 | 39 | 11 | 3 |
| 2. Módulo de Cadastros | 59 | 58 | 1 | 7 |
| 3. Módulo Ambulatorial | 73 | 63 | 10 | 4 |
| 10. Módulo de Integração com o e-SUS | 20 | 20 | 0 | 2 |
| 12. Módulo de Odontologia | 20 | 20 | 0 | 14 |
| 14. Módulo de Vacinação | 19 | 16 | 3 | 5 |

## Implementados / parciais (amostra)

| ID | Tipo | Status | Fat. | Código |
|---|---|---|---|---|
| RF-1.2 | Obr | parcial | n/a | `apps/api/src/auth` |
| RF-1.4 | Obr | parcial | n/a | `apps/api/src/auth#users` |
| RF-1.14 | Obr | parcial | n/a | `apps/api/.../audit + auth` |
| RF-2.2 | Obr | parcial | n/a | `apps/api/src/organization#professionals` + **import PF CNES** (`POST /v1/cnes/sync-professionals`, snapshot `franca-*-professionals.json`) |
| RF-2.17 | Obr | parcial | n/a | `GET/POST /v1/appointments` · `day-grid` · `itemType` CONSULTA/ENCAIXE · `careLine` APS/ODONTO |
| RF-2.19 | Obr | parcial | n/a | `apps/api/src/organization#teams` + **import CNES** (`POST /v1/cnes/sync`, INE unique) |
| RF-2.27 | Obr | parcial | n/a | `apps/api/src/patients` (+ PATCH + UI) |
| RF-2.29 | Obr | parcial | n/a | território + microáreas/vínculos + **Household/Family CDS** (`/v1/households`, catálogo LEDI, UI `/territorio`) — sem GIS/lote XML |
| RF-17.11 | Obr | parcial | n/a | visita ACS `AcsHomeVisit` · `GET/POST /v1/acs-home-visits` · catálogo motivos/desfecho LEDI · UI `/territorio` aba Visitas ACS — sem lote XML tipo 8 |
| RF-17.12 | Obr | parcial | n/a | lat/long opcional na visita + `mapUrl` OpenStreetMap externo (sem Leaflet/Mapbox) |
| RF-2.30 | Obr | parcial | n/a | cadastro individual CDS: nacionalidade/IBGE nasc./etnia/deficiência/NIS/e-mail + `links` no GET paciente · UI `/pacientes/[id]` |
| RF-2.47 | Obr | parcial | n/a | `facilities` + IBGE + UI `/unidades` + **sync CNES** (`data/cnes/franca-3516200.json`) |
| RF-2.56 | Obr | parcial | n/a | `apps/api/src/patients#search` + UI |
| RF-3.1 | Obr | parcial | automatizado | `POST /v1/encounters` fila SOAP + origem FAI `/aps` (paciente+lotação) · CIAP/CID `CodeSearchSelect` em `/atendimento/[id]` |
| RF-3.24 | Obr | parcial | automatizado | ficha APS `/aps/[id]` SOAP+antropometria · preview-fai · finish → batch · fila `/faturamento/aps` |
| RF-3.55 | Obr | parcial | automatizado | campos FAI financiamento mínimos (tipos 1/2/4/5/6, medições, SOAP, condutas, CIAP/CID, SIGTAP) |
| RF-10.3 | Obr | parcial | automatizado | mapper LEDI v2 + lotação + `/ledi/enums` + UI `/producao` · finish FAI/FAO → motor `clinical-core` (`source=native`) · **wizard lote** `/faturamento/lote/{fai,fao,proc}` (gate de tipo + 2 ZIPs) |
| RF-10.2 | Obr | parcial | n/a | sync CNES Franca `POST /v1/cnes/sync?gestao=municipal` (default Prefeitura · natureza 1244) · `gestao=todos` · snapshot `data/cnes/franca-3516200.json` · **PF** `POST /v1/cnes/sync-professionals` · `npm run sync:cnes` · UI `/unidades` + `/cadastros/cnes-auditoria` |
| RF-9.6 | Des | parcial | previsto | auditoria CNES `GET /v1/cnes/audit?gestao=municipal` · UI `/cadastros/cnes-auditoria` · export CSV |
| RF-10.21 | Des | parcial | automatizado | auditoria faturamento `GET /v1/faturamento/audit?gestao=municipal` · UI `/faturamento/auditoria` (ficha×rede municipal CNES/INE/CNS/SIGTAP) |
| RF-10.20 | Obr | parcial | automatizado | preflight + `POST /production/send` + UI `/producao` |
| RF-14.1 | Obr | parcial | automatizado | `vaccination_immunobiologicals` + seed LEDI v3 (99) doses `lediId` |
| RF-14.2 | Obr | parcial | automatizado | catálogo completo LEDI + Prisma + `POST …/catalog/vaccination/sync` overlay |
| RF-14.7 | Obr | parcial | automatizado | 54 faixas seed PNI + Prisma `vaccination_age_ranges` |
| RF-14.8 | Obr | parcial | automatizado | bloqueio idade em `create` via `validateAgeForApplications` |
| RF-14.11 | Obr | parcial | automatizado | aplicação + batch + `clinical-core` VAC + UI `/vacinacao` + `POST …/void` local |
| RF-14.13 | Obr | parcial | previsto | `GET …/vaccination-card.pdf` + botão imprimir em `/vacinacao` |
| RF-14.14 | Obr | parcial | automatizado | lote/fabricante + `lotExpiry` opcional na aplicação |
| RF-14.3 | Des | parcial | n/a | faixa °C alvo no lote + herdada do equipamento frio |
| RF-14.4 | Obr | parcial | automatizado | `VaccinationSupply` + `SupplyLink` imuno→insumo (sem farmácia geral) |
| RF-14.5 | Obr | stub | n/a | nº doses no cadastro vacina — catálogo LEDI; qty estoque separada |
| RF-14.6 | Obr | parcial | automatizado | baixa insumos na aplicação + estorno no void |
| RF-14.15 | Obr | parcial | automatizado | `POST /v1/vaccination-stock` entrada por unidade + lote (+ equipamento) |
| RF-14.16 | Des | parcial | automatizado | listagem qty + baixa no `create` se estoque do lote existir |
| RF-14.17 | Obr | parcial | automatizado | `VaccinationColdEquipment` CRUD + vínculo no lote |
| RF-14.18 | Obr | parcial | automatizado | `VaccinationThermalBox` CRUD + status operacional |
| RF-14.19 | Obr | parcial | automatizado | leitura **manual** °C + `withinRange`; **não** IoT contínuo |
| RF-12.2 | Obr | coberto | automatizado | lotação/`assignmentId` na abertura `/odonto` + header LEDI |
| RF-12.3 | Obr | coberto | automatizado | paciente na abertura + identificação na ficha |
| RF-12.5 | Obr | coberto | automatizado | `tipoAtendimento` (default 5) + UI select |
| RF-12.6 | Obr | coberto | automatizado | `tiposEncamOdonto` = `LEDI_CONDUTA_ODONTO` (UI + lote) |
| RF-12.7 | Obr | coberto | automatizado | FAO: vigilância + finish/`validateFaoJson` + preview; aviso Previne 99 (não BLOCKER). FAI lote: autofix seguro (st/turno/local/IBGE/UUID) sem inventar CIAP/conduta |
| RF-12.8 | Obr | coberto | previsto | `tiposFornecimOdonto` UI + mapper |
| RF-12.9 | Obr | coberto | previsto | anamnese + antecedentes/observações (careJson) Onda 1 |
| RF-12.1 | Obr | parcial | automatizado | `/odonto/agenda` + `/aps/agenda` · grade horários×profissional · CONSULTA (tipo 2) / ENCAIXE (tipo 5) · `POST …/open-dental` · `POST …/open-aps`; sem cadastro livre de tipos, salas, grade municipal |
| RF-2.36 | Obr | parcial | automatizado | catálogo fechado CONSULTA/ENCAIXE em `GET /v1/appointments/catalog` (não é cadastro TR completo) |
| RF-3.5 | Obr | parcial | automatizado | `POST /v1/appointments/:id/open-aps` → Encounter FAI `/aps/[id]` |
| RF-12.4 | Obr | parcial | previsto | ciclo `careJson.treatment` (iniciar/finalizar ≠ finish FAO); interrupção formal depois |
| RF-12.16 | Obr | parcial | automatizado | problemas CIAP/CID (`CodeSearchSelect`); patologias ricas depois |
| RF-12.12 | Obr | parcial | automatizado | odontograma FDI + Q/S/BOCA + faces careJson (cruz M/D/V/L/O) em `/odonto/[id]` · `odontogramJson` · proc. `tooth`\|`region` → mapper; gap: Thrift FAO sem tooth/region/face |
| RF-12.11 | Obr | coberto | automatizado | `GET …/odontogram-history` (inclui `treatmentId`) · `PATCH …/odontogram-history/:sourceId` · timeline + filtro “só tratamento atual” + “Usar neste atendimento” em `/odonto/[id]` |
| RF-12.13 | Obr | coberto | automatizado | catálogo predefinido `GET /v1/catalog/dental#predefinedProcedures` · PATCH lista + `done` · FAO só `done !== false` · UI `/odonto/[id]` |
| RF-12.20 | Obr | parcial | previsto | lista `/odonto` cronológica básica |
| RF-3.54 | Obr | parcial | automatizado | `ledi-homecare-v2` multi-child (1–99) · UI `/ad` CIAP/CID + `POST …/preview` preflight · desfecho/condições/tipo LEDI |
| RF-3.53 | Obr | parcial | automatizado | `ledi-collective-v2` + UI `/coletivo` enums LEDI + participantes nominais |
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
| RF-2.60 | Obr | parcial | n/a | `assignments` + UI `/lotacoes` + header LEDI + **sync PF** CNS+CBO+CNES+INE |
| RF-5.* | Obr/Des | não iniciado | n/a | backlog SAMU — `Samu/` · doc 12 |
| RF-16.1 | Obr | parcial | n/a | `apps/api/src/reports` |
| RF-16.7 | Obr | parcial | n/a | `apps/api/src/reports#vaccinations` |

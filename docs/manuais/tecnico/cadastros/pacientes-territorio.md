# Manual técnico — Pacientes e território (P2)

| Campo | Valor |
|---|---|
| id | cadastros.pacientes-territorio |
| version | 1.3.0 |
| status | draft |
| atualizado | 2026-08-16 |

**RF:** RF-2.27, RF-2.56, RF-2.29, RF-2.30 (Obrigatórios — parciais)

## Endpoints

| Método | Path | Uso |
|---|---|---|
| GET/POST | `/api/v1/teams` | Equipes por unidade |
| GET/POST | `/api/v1/micro-areas` | Microáreas (`?teamId=`) |
| GET/POST | `/api/v1/patient-team-links` | Vínculo paciente↔equipe(+microárea) |
| PATCH | `/api/v1/patient-team-links/:id` | Desativar / ajustar microárea |
| GET/PATCH | `/api/v1/patients/:id` | Ficha; GET inclui `links` e `familyMemberships` |
| GET | `/api/v1/catalog/household` | Tipos imóvel / condição moradia / parentesco (códigos LEDI) |
| GET/POST | `/api/v1/households` | Domicílios (`?teamId` · `?microAreaId` · `?patientId`) |
| GET/PATCH | `/api/v1/households/:id` | Detalhe / desativar / editar |
| POST | `/api/v1/households/:id/families` | Nova família no imóvel |
| PATCH | `/api/v1/household-families/:id` | Editar / desativar família |
| POST | `/api/v1/household-families/:id/members` | Incluir membro |
| PATCH | `/api/v1/family-members/:id` | Ajustar parentesco / desativar |

## Modelo (RF-2.29)

- `Household` — imóvel/domicílio (tipo LEDI `propertyType`, endereço, condição moradia opcional; **sem** lat/long GIS)
- `HouseholdFamily` — família no imóvel (responsável + renda/resideDesde)
- `FamilyMember` — paciente ↔ família (`RESPONSAVEL` \| `CONJUGE` \| `FILHO` \| `OUTRO`)

`microAreaId`, se informado, deve pertencer ao mesmo `teamId`.

## UI

`apps/web/src/app/territorio/page.tsx` (abas microáreas · vínculos · domicílios) · ficha em `pacientes/[id]`.

## Fora de escopo nesta fatia

GIS / mapa · lote XML Cadastro Domiciliar · visita ACS com lat/long · instituição de permanência completa.

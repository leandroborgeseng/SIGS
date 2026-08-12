# Manual técnico — Pacientes e território (P2)

| Campo | Valor |
|---|---|
| id | cadastros.pacientes-territorio |
| version | 1.1.0 |
| status | draft |
| atualizado | 2026-08-10 |

**RF:** RF-2.27, RF-2.56, RF-2.29 (Obrigatórios)

## Endpoints

| Método | Path | Uso |
|---|---|---|
| GET/POST | `/api/v1/teams` | Equipes por unidade |
| GET/POST | `/api/v1/micro-areas` | Microáreas (`?teamId=`) |
| GET/POST | `/api/v1/patient-team-links` | Vínculo paciente↔equipe(+microárea) |
| GET/PATCH | `/api/v1/patients/:id` | Ficha + edição |

Listagens de microáreas/vínculos incluem relações (`team.facility`, `patient`, `microArea`) para a UI.

## Regra

`microAreaId`, se informado, deve pertencer ao mesmo `teamId` (validado no service).

## UI

`apps/web/src/app/territorio/page.tsx` · resumo em `pacientes/[id]`.

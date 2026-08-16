# Manual técnico — Pacientes e território (P2)

| Campo | Valor |
|---|---|
| id | cadastros.pacientes-territorio |
| version | 1.2.0 |
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
| GET/PATCH | `/api/v1/patients/:id` | Ficha + edição; GET inclui `links` ativos |

Campos CDS (RF-2.30): `nationality`, `birthMunicipalityIbge`, `ethnicity`, `hasDisability`, `disabilityCodes`, `email`, `nis`, `educationLevel`.

## Regra

`microAreaId`, se informado, deve pertencer ao mesmo `teamId` (validado no service).  
Nacionalidade `BRASILEIRA` exige IBGE de nascimento; indígena exige etnia; deficiência exige códigos.

## UI

`apps/web/src/app/territorio/page.tsx` · ficha CDS + vínculos em `pacientes/[id]`.

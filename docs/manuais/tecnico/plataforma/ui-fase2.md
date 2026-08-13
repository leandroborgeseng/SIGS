# Manual técnico — UI fase 2 (Next.js)

| Campo | Valor |
|---|---|
| id | plataforma.ui-fase2 |
| version | 1.0.0 |
| status | draft |
| atualizado | 2026-08-10 |

## Stack

- `apps/web` — Next.js 15 App Router, React 19, CSS tokens do handoff Claude
- Auth: Bearer JWT em `localStorage` (`sigs_token`)
- Unidade: `localStorage` (`sigs_facility_id`)
- API: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`)

## Rotas UI ↔ API

| UI | API |
|---|---|
| Login | `POST /v1/auth/login` |
| Sessão | `GET /v1/auth/me` |
| Unidades | `GET/POST /v1/facilities` |
| Pacientes | `GET/POST /v1/patients` |
| Agenda | `GET/POST/PATCH/DELETE /v1/appointments` · `GET …/day-grid` · `GET …/catalog` · `POST …/:id/open-dental` · `POST …/:id/open-aps` · UI `/odonto/agenda` · `/aps/agenda` |
| Fila | `GET /v1/encounters/queue`, `POST /v1/encounters`, clínico/finish |
| Vacina | `GET /v1/catalog/vaccination`, `POST /v1/vaccinations` |
| Relatórios | `GET /v1/reports/encounters\|vaccinations` |
| Admin | `GET /v1/users`, `/v1/roles`, `/v1/audit` |

## Design

Fonte visual: `docs/design/entregas/2026-08-10-claude-design-mvp/`. Brand GestOP `#0066CC`, IBM Plex Sans/Mono.

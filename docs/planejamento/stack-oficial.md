# Estratégia de stack — alinhamento municipal

**Decisão:** 2026-08-10  

O bootstrap em **Python/FastAPI** foi provisório (Node ausente no PATH do agente).  
A stack **oficial** do SIGS passa a ser a mesma dos outros sistemas municipais (ex.: Portal de Legislação / Nexo):

| Camada | Stack |
|---|---|
| Monorepo | npm workspaces (`apps/*`) |
| API | **NestJS 11** + class-validator |
| Persistência | **Prisma** + SQLite local (dev) → PostgreSQL em deploy (como LeisMunicipais) |
| Web | **Next.js 15** + React 19 (UI de produto na fase 2 / Claude Design) |
| Node | ≥ 20 (binário local em `tools/node`) |

## Código legado

- `apps/api-python/` — bootstrap FastAPI **deprecated** (referência de regras; não evoluir)

## Código oficial

- `apps/api` — NestJS
- `apps/web` — Next.js (shell mínimo até fase UI)

## Agenda (P3)

Status de slot (design): `SCHEDULED` · `PRESENT` · `NO_SHOW` · `DID_NOT_WAIT` · `CANCELLED` · `COMPLETED` · `DELETED`  
**Regra:** exclusão lógica só se status atual = `SCHEDULED`.

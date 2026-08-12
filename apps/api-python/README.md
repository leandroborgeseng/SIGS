# SGS API — backend-first (sem UI de produto)

Reescrita APS + inclusões TR. Estratégia: `docs/planejamento/estrategia-reescrita-fase1.md`.

## Subir

```bash
# na raiz do repo
source .venv/bin/activate
export PYTHONPATH=apps/api/src
uvicorn sgs_api.main:app --reload --port 8000
```

- Health: http://127.0.0.1:8000/health  
- Swagger: http://127.0.0.1:8000/docs  
- DB default: SQLite `apps/api/.data/sgs.db`  
- Postgres: `export SGS_DATABASE_URL=postgresql+psycopg://user:pass@localhost/sgs`

## Módulos

| Área | Paths |
|---|---|
| Organização | `/api/v1/facilities`, `/professionals`, `/teams` |
| Pacientes | `/api/v1/patients` |
| Território | `/api/v1/micro-areas`, `/patient-team-links` |
| Produção/faturamento | `/api/v1/production/batches` |
| RF / auditoria | `/api/v1/rf/anchors`, `/api/v1/audit` |

## Testes

```bash
PYTHONPATH=apps/api/src .venv/bin/pytest apps/api/tests -q
```

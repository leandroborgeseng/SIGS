# Manual técnico — Relatórios mínimos

**Versão:** 0.5.0-dev  
**RF:** RF-16.1 (e vizinhos de vacinas do dia)

## Endpoints (permissão `reports.read`)

| Path | Conteúdo |
|---|---|
| `GET /api/v1/reports/encounters?from=&to=&facilityId=` | Lista + totais por status |
| `GET /api/v1/reports/vaccinations?from=&to=&facilityId=` | Doses aplicadas no período |

Export CSV fica para a UI (fase 2); API devolve JSON consumível.

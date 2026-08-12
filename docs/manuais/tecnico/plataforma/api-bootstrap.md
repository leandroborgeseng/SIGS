# Manual técnico — API SGS (bootstrap)

**Versão:** 0.1.0-dev  
**Módulo:** plataforma / organização / produção  
**Público:** TI / desenvolvimento  

## Objetivo

Bootstrap da reescrita APS sem UI de produto. Expõe health, cadastros mestres in-memory e fila de lotes de produção para testes de faturamento parciais.

## Como subir

Ver `apps/api/README.md`.

## Endpoints relevantes

| Método | Path | RF âncora | Fat. |
|---|---|---|---|
| GET | `/health` | — | n/a |
| GET | `/api/v1/rf/anchors` | vários | metadados |
| GET/POST | `/api/v1/facilities` | RF-2.47 (Obr.) | n/a |
| GET/POST | `/api/v1/professionals` | RF-2.2 (Obr.) | n/a |
| GET/POST | `/api/v1/teams` | RF-2.19 (Obr.) | n/a |
| GET | `/api/v1/audit` | RF-1.14 (Obr.) | n/a |
| POST | `/api/v1/production/batches` | RF-10.3 / 10.20 (Obr.) | automatizado (stub) |

## Persistência

In-memory. Não usar com dados reais. PostgreSQL na próxima fatia.

## Teste de faturamento parcial

1. `POST /api/v1/production/batches` com `kind` + `payload` LEDI-like + `rf_ids`
2. Status inicial `ready`
3. `POST .../mark-sent` simula envio
4. Conferir `/api/v1/audit`

## UI

Adiada — fase Claude Design. Manual de usuário desta fatia: stub (sem telas).

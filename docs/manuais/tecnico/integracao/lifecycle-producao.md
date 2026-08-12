# Manual técnico — Lifecycle de lotes de produção

**Versão:** 0.1.0-dev  
**RF:** RF-10.20, RF-10.3

## Status

| Status | Significado |
|---|---|
| `draft` | Rascunho / enqueue manual |
| `ready` | Pronto para pré-envio e envio |
| `sent` | Marcado como enviado (local) |
| `error` | Bloqueado / falha de validação |

Campos: `errorMessage`, `statusChangedAt`.

## Transições

```text
draft  → ready | error
ready  → sent | error | draft
error  → ready | draft
sent   → ready   (reopen)
```

## API

| Método | Path | Efeito |
|---|---|---|
| POST | `/v1/production/batches/:id/reprocess` | Valida → `ready` ou `error` |
| POST | `/v1/production/batches/:id/promote` | draft/error → reprocess |
| POST | `/v1/production/batches/:id/mark-error` | → `error` |
| POST | `/v1/production/batches/:id/reopen` | `sent` → `ready` |
| POST | `/v1/production/send` | `{ markBlockedAsError? }` marca bloqueados como error |

Finish clínico continua criando lotes em `ready`.

## Código

`apps/api/src/production/lifecycle.ts` · `production.service.ts`

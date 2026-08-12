# SIGS — Sistema de Gestão em Saúde (Franca)

Monorepo no mesmo molde dos outros sistemas municipais:

**NestJS + Prisma + Next.js** (workspaces).

> UI de produto: fase 2 (Claude Design). Backend-first agora.

## Pré-requisito Node

```bash
export PATH="$PWD/tools/node/bin:$PATH"   # Node 22 local do repo
node -v
```

## API (agora)

```bash
export PATH="$PWD/tools/node/bin:$PATH"
npm run dev:api
# login: POST /api/v1/auth/login  { "email":"admin@sigs.local", "password":"admin123" }
```

Health público: http://127.0.0.1:3001/api/health  
Demais rotas: `Authorization: Bearer <token>`

## Apps

| App | Path | Papel |
|---|---|---|
| `@sigs/api` | `apps/api` | NestJS + Prisma |
| `@sigs/web` | `apps/web` | Next.js (shell) |
| ~~api-python~~ | `apps/api-python` | Deprecated |

## Docs

- [`docs/planejamento/stack-oficial.md`](docs/planejamento/stack-oficial.md)
- [`docs/planejamento/estrategia-reescrita-fase1.md`](docs/planejamento/estrategia-reescrita-fase1.md)
- [`docs/design/entregas/`](docs/design/entregas/) — protótipo Claude Design

# Deploy SIGS — Railway / Coolify

**Stack:** NestJS + Next.js + Prisma **PostgreSQL** + storage local/S3 + Redis/BullMQ (opcional).

## Artefatos

| Arquivo | Uso |
|---|---|
| `Dockerfile` | Imagem (API + Web + worker conforme `PROCESS_ROLE`) |
| `docker/entrypoint.sh` | `prisma db push` + start por role |
| `docker-compose.yml` | Local completo (postgres/redis/minio/api/worker/web) |
| `.env.example` | Variáveis |
| `railway.variables.txt` | Colar no painel Railway |

---

## Railway — caminho rápido (1 serviço) ✅ recomendado p/ primeiro deploy

Arquitetura: **um container** `PROCESS_ROLE=all` — porta pública **:3000** = `docker/public-proxy.mjs` (pipe stream `/api` → Nest **:3001**; UI → Next **:3002**). ZIP LEDI grande **não** vai num multipart único (o gateway Railway trunca): a UI envia fatias `POST /api/v1/dental/ledi/batches/upload-zip/chunk` (`application/octet-stream`, **512 KiB**). Jobs LEDI **inline** até você ligar Redis.

### 1. Código no GitHub

O Railway faz deploy do branch. Garanta que `main` tem o schema Postgres e o `Dockerfile` atual.

### 2. Projeto no Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → repo `SIGS`.
2. Se não detectar Docker: Settings → **Build** → Builder = Dockerfile · Dockerfile path = `Dockerfile`.
3. **Networking** → **Generate Domain** · **Target port = 3000**.

### 3. PostgreSQL

1. No projeto: **+ New** → **Database** → **PostgreSQL**.
2. No serviço SIGS → **Variables** → **Add Variable** → **Add Reference** → `Postgres` → `DATABASE_URL`  
   (ou cole a connection URL do plugin).
3. **Remova** qualquer `DATABASE_URL=file:...` antigo.

### 4. Volume (storage local dos XMLs)

Settings → **Volumes** → mount path **`/data`**.

Variáveis:
```text
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=/data/storage
```

### 5. Variables (runtime)

Copie de `railway.variables.txt`, ajustando o domínio gerado:

| Variável | Valor |
|---|---|
| `PROCESS_ROLE` | `all` |
| `PORT` | `3000` |
| `API_PORT` | `3001` |
| `DATABASE_URL` | referência do Postgres |
| `JWT_SECRET` | string longa aleatória |
| `CORS_ORIGIN` | `https://SEU-DOMINIO.up.railway.app` |
| `NEXT_PUBLIC_API_URL` | `https://SEU-DOMINIO.up.railway.app/api` |
| `API_INTERNAL_URL` | `http://127.0.0.1:3001` |
| `SEED_ADMIN_EMAIL` | seu e-mail |
| `SEED_ADMIN_PASSWORD` | senha forte (**≥12** chars; sem isso o boot não cria admin fraco) |
| `STORAGE_DRIVER` | `local` |
| `STORAGE_LOCAL_PATH` | `/data/storage` |

### 6. Build arg (obrigatório)

`NEXT_PUBLIC_*` é embutido no **build** do Next.

No serviço → **Variables** → marque `NEXT_PUBLIC_API_URL` também disponível no build  
(ou Settings → Build → Build Args):

```text
NEXT_PUBLIC_API_URL=https://SEU-DOMINIO.up.railway.app/api
```

Redeploy após definir o domínio definitivo.

### 7. Smoke test

1. Abra o domínio → `/login`: campos **vazios** (não deve aparecer `admin@sigs.local` / `admin123` no HTML). Entre com `SEED_ADMIN_*` das Variables.
2. View-source ou DevTools → Network → documento `/login`: buscar `admin123` → **0 ocorrências**.
3. `https://SEU-DOMINIO.up.railway.app/api/health` → `status: ok`, `queue: inline` (sem Redis) ou `redis-bullmq`.
4. `https://SEU-DOMINIO.up.railway.app/api/ready` → `checks.postgres.ok = true`.
5. Odonto → Lote LEDI → upload pequeno → auto-fix → export ZIP.

### Boot / health (logs)

No Deploy Logs do Railway, o entrypoint e a API devem mostrar linhas claras:

- `SIGS entrypoint · role=all · DB=host:5432/railway · redis=absent`
- `INFO: REDIS_URL ausente — fila BullMQ inline…` (esperado no 1º deploy)
- `SIGS api boot · … · queue=inline`
- `SIGS API online · … health=/api/health · ready=/api/ready`

Se faltar `DATABASE_URL` ou `JWT_SECRET` (production), o processo **aborta com ERROR** legível — não sobe “mudo”.

`SEED_ADMIN_PASSWORD` fraca/ausente em production: **WARN** no log (não aborta). Se ainda não existir usuário admin, ele **não** é criado até você definir senha ≥12 e redeployar. A UI de login **nunca** embute senha seed em `NODE_ENV=production`.

**Healthcheck Railway (Settings → Healthcheck):** path `/api/health`, porta **3000** (public-proxy → Nest). O Dockerfile também tem `HEALTHCHECK` interno (API `:3001` ou proxy).

**Redis:** opcional. Sem `REDIS_URL` a API sobe; jobs LEDI/SIGTAP rodam inline. `PROCESS_ROLE=worker` exige Redis.

---

## Railway — escala (opcional, depois)

| Serviço | `PROCESS_ROLE` | Público | Notas |
|---|---|---|---|
| `api` | `api` | sim (domínio API) | Target port = `PORT` do Railway |
| `web` | `web` | sim | Build com `NEXT_PUBLIC_API_URL=https://api.../api` |
| `worker` | `worker` | não | Exige `REDIS_URL` |
| Postgres | — | — | compartilhado |
| Redis | — | — | plugin Redis |

Storage em produção multi-réplica: use S3/R2 (`STORAGE_DRIVER=s3` + `S3_*`), não disco local.

---

## Coolify

Use `docker-compose.yml` (postgres + redis + minio + api + worker + web) ou Dockerfile com `PROCESS_ROLE=all` + Postgres gerenciado.

## Segurança

- Troque `JWT_SECRET` e senha admin no primeiro deploy.
- XMLs LEDI = dados pessoais — volume privado; sem commit.
- `CORS_ORIGIN` = só o domínio do front.
- Não use hostname `*.railway.internal` em `NEXT_PUBLIC_*` (só browser → domínio público).

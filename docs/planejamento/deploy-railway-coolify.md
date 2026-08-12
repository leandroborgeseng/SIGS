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

Arquitetura: **um container** `PROCESS_ROLE=all` (Web pública :3000 + API interna :3001 + proxy Next `/api` → API). Jobs LEDI **inline** até você ligar Redis.

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
| `SEED_ADMIN_PASSWORD` | senha forte |
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

1. Abra o domínio → login (`SEED_ADMIN_*`).
2. `https://SEU-DOMINIO.up.railway.app/api/health`
3. `https://SEU-DOMINIO.up.railway.app/api/ready` → `postgres.ok = true`
4. Odonto → Lote LEDI → upload pequeno → auto-fix → export ZIP.

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

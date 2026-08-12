# Deploy SIGS — Railway / Coolify

**Stack:** NestJS (`apps/api`) + Next.js (`apps/web`) + Prisma (SQLite em volume; Postgres opcional depois).

## Artefatos

| Arquivo | Uso |
|---|---|
| `Dockerfile` | Imagem única (API :3001 + Web :3000) |
| `docker-compose.yml` | Local / Coolify compose |
| `.env.example` | Variáveis |
| `docker/entrypoint.sh` | `prisma db push` + sobe API e Web |

## Coolify

1. Novo recurso **Dockerfile** (ou Docker Compose) apontando para este repositório.
2. Porta pública: **3000** (UI). Se quiser expor a API, publique também **3001** ou coloque proxy `/api` → `3001`.
3. Volume persistente em `/data` (SQLite `DATABASE_URL=file:/data/sigs.db`).
4. Variáveis:
   - `JWT_SECRET` — obrigatório, forte
   - `CORS_ORIGIN` — URL pública do front (ex. `https://sigs.seudominio.gov.br`)
   - `NEXT_PUBLIC_API_URL` — URL pública da API **incluindo** `/api` (ex. `https://sigs.seudominio.gov.br:3001/api` ou `https://api.sigs.../api`)
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (primeiro boot)
5. Build arg / env de build: `NEXT_PUBLIC_API_URL` precisa estar definido **no build** do Next (valores `NEXT_PUBLIC_*` são embutidos).

### Proxy único (recomendado)

No Coolify, use um domínio na porta 3000 e outro (ou path) para 3001. Alternativa: colocar um reverse proxy na frente mapeando `/api` → API.

## Railway

1. **New Project** → Deploy from GitHub (este repo).
2. Railway detecta o `Dockerfile` (**não** declare `VOLUME` no Dockerfile — o Railway rejeita; use Volume do painel).
3. Add **Volume** montado em `/data` (Settings → Volumes).
4. Variables iguais ao Coolify.
5. Gere domínio público; ajuste `CORS_ORIGIN` e `NEXT_PUBLIC_API_URL` para esse domínio.
6. Exponha a porta do serviço Web (3000). Para a API no mesmo container, configure um segundo domínio/TCP na 3001 **ou** use dois serviços (API e Web) no mesmo projeto.

### Dois serviços no Railway (alternativa)

- Serviço **api**: Dockerfile com target/custom start só da API; `PORT` fornecido pelo Railway.
- Serviço **web**: build Next com `NEXT_PUBLIC_API_URL=https://<api>.up.railway.app/api`.

O `Dockerfile` atual sobe os dois processos; o volume SQLite precisa estar no serviço que roda a API.

## Local com Docker

```bash
export PATH="$PWD/tools/node/bin:$PATH"
docker compose up --build
```

UI: http://localhost:3000 · API: http://localhost:3001/api  
Login demo: `admin@sigs.local` / `admin123`

## Lote LEDI FAO (produção odonto)

Após o deploy: **Odontologia → Lote LEDI FAO** (`/odonto/lote`).

1. Upload dos XMLs tipo 5.
2. Ver inconsistências agregadas.
3. Confirmar auto-correção (`stNaoPossuiCpf`, INE).
4. Editar fichas restantes (CIAP/CID, tipo consulta).
5. Baixar ZIP dos XMLs corrigidos.

## Postgres (próximo passo)

O schema Prisma atual usa **SQLite** (simples no Coolify/Railway com volume). Para Postgres:

1. Trocar `provider` em `apps/api/prisma/schema.prisma` para `postgresql`.
2. `DATABASE_URL=postgresql://user:pass@host:5432/sigs`
3. Rodar `prisma migrate` / `db push` no entrypoint.

## Segurança

- Troque `JWT_SECRET` e senha admin.
- XMLs com CNS/CPF são dados pessoais — volume privado, sem commit no Git.
- `CORS_ORIGIN` restrito ao domínio do front.

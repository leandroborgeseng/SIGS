# Arquitetura para produção e escala — diagnóstico e plano

**Status:** implementação fundação A–D em andamento / parcial ✅  
**Atualizado:** 2026-08-12  
**Contexto:** município ~350 mil hab. · monólito modular · Nest + Prisma + Next  
**Requisitos do usuário:** backend stateless · PostgreSQL · Redis · filas/workers · S3-compatible · idempotência · auditoria · observabilidade · portabilidade (Railway ≠ lock-in)

---

## 0. O que já está no código (esta fatia)

| Peça | Estado |
|---|---|
| Prisma `provider = postgresql` | ✅ |
| Índices quentes + `JobRun` + audit enriquecido | ✅ |
| `StorageService` (S3/MinIO ou local) | ✅ LEDI dual-write |
| BullMQ + `REDIS_URL` (fallback inline) | ✅ |
| `apps/api/src/worker.main.ts` | ✅ |
| Auto-fix/export async (202 + `GET /v1/jobs/:id`) | ✅ |
| Correlation ID + audit userId/ip | ✅ |
| Optimistic lock `version` no patch LEDI | ✅ |
| Compose: postgres + redis + minio + api + worker + web | ✅ |
| `GET /api/ready` (ping Postgres) | ✅ |

**Dev rápido sem Docker de app:** `npm run infra:up` + `npm run dev` (jobs inline se sem Redis).

---

## 1. Situação atual (mapa)

```text
Usuário → Next.js (CSR + localStorage JWT)
              │
              ▼
         NestJS API (stateless JWT + correlation-id)
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
 Postgres   Redis    S3/MinIO
     ▲        │        ▲
     │        ▼        │
     └── Worker (BullMQ) ──┘
```

| Camada | Agora |
|---|---|
| Persistência | **PostgreSQL** |
| Deploy Compose | api / worker / web separados + postgres / redis / minio |
| Filas | BullMQ (`REDIS_URL`) ou inline (dev) |
| Arquivos | Object Storage + inline curto no Postgres |
| Jobs LEDI | `ledi.auto-fix`, `ledi.export-zip` |
| Observabilidade | health + ready + x-correlation-id |

### Ainda em evolução

- Migração formal Prisma (`migrate`) vs `db push` no boot
- Presigned download do ZIP de export na UI
- Métricas Prometheus / OpenTelemetry
- HA Postgres managed + multi-réplica API

---

## 2. Riscos remanescentes (P1+)

5. Auto-fix ainda last-write por item (patch tem `expectedVersion`)
6. Unique CPF/CNS / merge paciente — pendente domínio
7. Observabilidade avançada (métricas/tracing) — próximo ciclo

---

## 3. Arquitetura-alvo

```text
                         Usuários
                            |
                         Next.js
                            |
                      Nest API (N réplicas)
                       /    |    \
                 Postgres  Redis  S3
                            |
                         Workers
```

Fases A→D desta entrega cobrem a fundação. Fase E (observabilidade / HA managed) fica para o próximo ciclo operacional.

Ver também: `.env.example`, `STATUS.md`, `docker-compose.yml`.

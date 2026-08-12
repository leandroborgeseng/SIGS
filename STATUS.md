# STATUS — SIGS

- **etapa_atual**: **Fundação de escala** + **deploy Railway** (Postgres)
- **como usar agora:**
  1. Local: `npm run infra:up` + `npm run dev` (se tiver Docker)
  2. Railway: guia `docs/planejamento/deploy-railway-coolify.md` · vars `railway.variables.txt`
  3. FAO `/odonto/lote` · FAI `/aps/lote` · PROC `/procedimentos/lote`
  4. Login seed: variáveis `SEED_ADMIN_*`
  5. Health `/api/health` · ready `/api/ready` · jobs `/api/v1/jobs/:id`
- **feito escala:** Postgres · Redis/BullMQ opcional · S3/local · worker · LEDI async · audit/correlation
- **deploy Railway (1º):** 1 serviço `PROCESS_ROLE=all` + plugin Postgres + volume `/data`
- **fora desta fatia:** UI produto fase 2 · multi-serviço Railway · R2/S3 gerenciado

_Atualizado em 2026-08-12_

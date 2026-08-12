# STATUS — SIGS

- **etapa_atual**: **Prioridade 1 — Lote LEDI FAO (faturamento odonto)** em execução local
- **como usar agora:**
  1. UI: http://localhost:3000 → login → abre direto em `/odonto/lote`
  2. Login: `admin@sigs.local` / `admin123`
  3. Enviar XMLs → auto-correção → editar restante → baixar ZIP
- **servidores locais:** API `:3001` · Web `:3000` (`npm run dev`)
- **feito:**
  - Lote LEDI FAO API + UI (upload, inconsistências, auto-fix, ZIP)
  - Entrada do sistema redireciona para `/odonto/lote`
  - Nav “Faturamento LEDI” no topo
  - Deploy: `Dockerfile` + `docker-compose.yml` + `docs/planejamento/deploy-railway-coolify.md`
- **canal:** LEDI FAO → Siaps → RNDS
- **proxima_acao:** processar lote real 1131 no `/odonto/lote` · depois Coolify/Railway · resto do sistema depois
- **docker:** `docker compose up --build`

_Atualizado em 2026-08-12_

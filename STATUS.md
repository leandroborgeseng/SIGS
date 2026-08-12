# STATUS — SIGS

- **etapa_atual**: **Prioridade 1 — Lote LEDI FAO (faturamento odonto)** em execução local
- **como usar agora:**
  1. UI: http://localhost:3000 → login → abre direto em `/odonto/lote`
  2. Login: `admin@sigs.local` / `admin123`
  3. Enviar XMLs → auto-correção → editar restante → baixar ZIP
- **servidores locais:** API `:3001` · Web `:3000` (`npm run dev`)
- **feito:**
  - Lote LEDI FAO API + UI (upload, auto-fix, ZIP)
  - **Raio-x Previne ESB (B1–B6)** + alertas com **botão/guia de correção** na UI
  - Patch ficha: INE, CIAP, CBO, vigilância, procs (B1/B5/B6), conduta 15
  - Entrada do sistema redireciona para `/odonto/lote`
  - Deploy: `Dockerfile` + `docker-compose.yml` + `docs/planejamento/deploy-railway-coolify.md`
- **canal:** LEDI FAO → Siaps → RNDS · Previne ESB como inteligência pré-envio
- **backlog registrado:**
  - Indicadores Previne (`14-…`) · vínculos obrigatórios (`15-…`)
- **proxima_acao:** processar lote 1131 com raio-x · push GitHub · depois NT 30/2025 / C*
- **docker:** `docker compose up --build`

_Atualizado em 2026-08-12_

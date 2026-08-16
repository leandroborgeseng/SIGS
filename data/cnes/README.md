# README — snapshots CNES

JSON público (sem PHI / sem dados de pacientes) para sync offline do município.

| Arquivo | IBGE | Conteúdo |
|---|---|---|
| `franca-3516200.json` | 3516200 | Estabelecimentos + equipes + campos de gestão |
| `franca-3516200-professionals.json` | 3516200 | Profissionais lotados (nome + CNS + CBO + INE) — rede municipal |

## Contagens Franca

| Escopo | Estabelecimentos | Equipes | Ativos (est.) | Profissionais | Lotações |
|---|---:|---:|---:|---:|---:|
| Cidade | 1346 | 124 | ~545 | — | — |
| **Rede municipal (Prefeitura)** | **66** | **123** | **59** | **503** | **742** |

**Critério unidades:** `naturezaJuridica=1244` (Município). CNPJ mantenedora Prefeitura: `47970769000104` (enriquecimento — `numero_cnpj` CNES nulo na rede 1244). Não filtrar só por `tipo_gestao=M`.

Lista UI `/unidades` e `GET /v1/facilities` default `gestao=municipal` (~59 ativas), não cidade (~545).
```bash
npm run sync:cnes -- --ibge=3516200 --source=snapshot --gestao=municipal
npm run sync:cnes -- --professionals --ibge=3516200
```

Docker copia `data/cnes` → `/app/data/cnes` + `apps/api/dist/cnes/snapshots`.

Railway: **Sincronizar rede municipal** → **Importar profissionais lotados**; `CNES_SYNC_ON_BOOT=1` (+ opcional `CNES_SYNC_PROFESSIONALS_ON_BOOT=1`).

Ver `docs/manuais/tecnico/cadastros/cnes-import.md`.

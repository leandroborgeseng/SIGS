# README — snapshots CNES

JSON público (sem PHI) para sync offline do município.

| Arquivo | IBGE | Conteúdo |
|---|---|---|
| `franca-3516200.json` | 3516200 | Estabelecimentos (API Dados Abertos, enriquecidos) + equipes (CnesWeb) |

## Contagens Franca

| Escopo | Estabelecimentos | Equipes | Ativos (est.) |
|---|---:|---:|---:|
| Cidade | 1346 | 124 | ~545 |
| **Rede municipal (Prefeitura)** | **66** | **123** | **59** |

**Critério:** `naturezaJuridica=1244` (Município). Não filtrar só por `tipo_gestao=M`.

Cada estabelecimento no JSON traz `tipoGestao`, `esferaAdministrativa`, `naturezaJuridica`, `razaoSocial`, `municipalNetwork`.

A imagem Docker copia esta pasta para `/app/data/cnes` e também embute em `apps/api/dist/cnes/snapshots`.

Sync default: `gestao=municipal` (só Prefeitura). Carga completa: `gestao=todos`.

```bash
npm run sync:cnes -- --ibge=3516200 --source=snapshot
npm run sync:cnes -- --ibge=3516200 --source=snapshot --gestao=todos
```

Ver `docs/manuais/tecnico/cadastros/cnes-import.md`.

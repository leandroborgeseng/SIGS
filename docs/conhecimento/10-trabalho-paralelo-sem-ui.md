# Trabalho paralelo (sem UI)

Enquanto o Claude Design gera a interface, avançamos artefatos que **não dependem** de layout:

| Artefato | Caminho | Status |
|---|---|---|
| Specs patient/encounter/vaccination | `data/esus/5.5.24/spec/` + `contexts/` | ✅ |
| Spec organization (unidade/prof/equipe) | `data/esus/5.5.24/spec/organization/` | ✅ |
| Modelo de dados conceitual MVP | `data/esus/5.5.24/analysis/data-model.md` | ✅ |
| Mapeamento LEDI vacinação | `data/esus/5.5.24/spec/ledi/vaccination-mapping.md` | ✅ |
| Mapeamento LEDI atendimento individual | `data/esus/5.5.24/spec/ledi/individual-encounter-mapping.md` | ✅ |
| OpenAPI MVP (+ cadastros mestres) | `contracts/openapi/sgs-mvp.openapi.yaml` | ✅ |
| Adendo Design (status/campos) | `docs/design/ADENDO-STATUS-E-CAMPOS.md` | ✅ |
| Primeiro manual (Central de Ajuda) | `docs/manuais/{usuario,tecnico}/plataforma/` | ✅ |

## Próximos (ainda sem UI)

1. Seeds de catálogos vacinais (estrutura JSON a partir de tabelas)
2. Spec território/domicílio
3. Esqueleto de domínio/backend **sem** componentes visuais (quando stack for escolhida)

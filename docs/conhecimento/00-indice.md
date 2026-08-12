# Conhecimento acumulado — índice

Documentos gerados a partir da análise do e-SUS APS **5.5.24** e das decisões do projeto SIGS.

| # | Arquivo | Assunto |
|---|---|---|
| 01 | [01-visao-e-objetivo.md](01-visao-e-objetivo.md) | Objetivo final do sistema municipal e o que NÃO fazer agora |
| 02 | [02-artefato-esus-5.5.24.md](02-artefato-esus-5.5.24.md) | JAR, versão, SHA-256, estrutura interna |
| 03 | [03-jars-e-arquitetura-bridge.md](03-jars-e-arquitetura-bridge.md) | JARs P0/P1, packages, camadas CDS/PEC |
| 04 | [04-mapa-funcional-esus.md](04-mapa-funcional-esus.md) | Áreas funcionais detectadas no artefato |
| 05 | [05-integracoes-e-gaps.md](05-integracoes-e-gaps.md) | LEDI, CadSUS, sync, lacunas |
| 06 | [06-principios-engenharia-reversa.md](06-principios-engenharia-reversa.md) | Regras do prompt mestre (não copiar, proveniência, confiança) |
| 07 | [07-mapeamento-tr-vs-esus.md](07-mapeamento-tr-vs-esus.md) | Ponte preliminar TR Franca ↔ cobertura e-SUS |
| 08 | [08-toolchain.md](08-toolchain.md) | Java, CFR, scripts, cache |
| 09 | [09-specs-patient-encounter-vaccination.md](09-specs-patient-encounter-vaccination.md) | Specs patient/encounter/vaccination |
| 10 | [10-trabalho-paralelo-sem-ui.md](10-trabalho-paralelo-sem-ui.md) | O que avançar sem design |
| 11 | [11-legado-faturamento-e-producao.md](11-legado-faturamento-e-producao.md) | **Legado → LEDI/BPA: banco, converters, o que fazer sem SIGTAP MS** |
| 12 | [12-samu-fonte-federal-backlog.md](12-samu-fonte-federal-backlog.md) | **SAMU: inventário `Samu/` + backlog S0–S4 (RF-5)** |
| 13 | [13-samu-o-que-vamos-enfrentar.md](13-samu-o-que-vamos-enfrentar.md) | **Síntese pós-decompilação: escala, dores, ordem** |
| 14 | [14-indicadores-aps-previne-brasil.md](14-indicadores-aps-previne-brasil.md) | **Indicadores APS Previne (CONASEMS jul/2026): C/B/CR/M — 19 indicadores** |
| 15 | [15-faturamento-indicadores-campos-obrigatorios.md](15-faturamento-indicadores-campos-obrigatorios.md) | **Faturamento federal × Previne: vínculos e campos obrigatórios de qualidade** |
| 16 | [16-tres-tipos-ficha-ledi-franca.md](16-tres-tipos-ficha-ledi-franca.md) | **FAI (4) × FAO (5) × Procedimentos (7): como identificar e onde corrigir** |
| 17 | [17-catalogo-erros-parser-ledi-fao.md](17-catalogo-erros-parser-ledi-fao.md) | **Catálogo completo: por quê e como corrigir cada código do parser** |

- raiz: `01-manifest.json` … `10-gaps.md`
- `data/esus/5.5.24/reports/`
- `data/esus/5.5.24/inventory/`


## Anexos (cópias dos relatórios da análise)

- [anexos-01-manifest.json](anexos-01-manifest.json)
- [anexos-07-functional-map.md](anexos-07-functional-map.md)
- [anexos-08-domain-map.md](anexos-08-domain-map.md)
- [anexos-09-integration-map.md](anexos-09-integration-map.md)
- [anexos-10-gaps.md](anexos-10-gaps.md)

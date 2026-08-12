# Documentação do projeto SIGS

Base de conhecimento para construção do **Sistema Municipal de Gestão em Saúde (SGS / SIGS)**, com engenharia reversa controlada do e-SUS APS e requisitos do Termo de Referência (Franca/SP).

## Índice

| Pasta / arquivo | Conteúdo |
|---|---|
| [conhecimento/](conhecimento/) | O que já aprendemos sobre o e-SUS, LEDI/faturamento, **SAMU (`12-…`)** e **[Indicadores APS / Previne (`14-…`)](conhecimento/14-indicadores-aps-previne-brasil.md)** |
| [requisitos/](requisitos/) | Requisitos funcionais oficiais do edital/TR |
| [manuais/](manuais/) | Política + templates de manuais técnico e usuário (DoD) |
| [planejamento/](planejamento/) | Plano MVP + **estratégia de reescrita** + [**arquitetura FHIR/motor/paciente mestre**](planejamento/arquitetura-fhir-motor-paciente-mestre.md) + [deploy](planejamento/deploy-railway-coolify.md) |
| [rastreabilidade/](rastreabilidade/) | Cobertura RF + [**cobertura LEDI erros (P0)**](rastreabilidade/cobertura-ledi-erros.md) |
| [design/](design/) | Prompt Claude Design + entregas de UI (**fase 2**) |
| [pipeline/](pipeline/) | Como rodar análise e decompilação |
| [`../apps/api/`](../apps/api/) | API FastAPI (reescrita backend-first) |
| [`../contracts/openapi/`](../contracts/openapi/) | OpenAPI MVP (sem UI) |
| [`../STATUS.md`](../STATUS.md) | Estado atual |

## Fontes de verdade (ordem de prioridade)

1. **Requisitos do TR** (`docs/requisitos/`) — o que o município contratou.
2. **Especificações derivadas do e-SUS** (`data/esus/<versão>/spec/` — em construção) — comportamento implementado na versão analisada.
3. **Normas oficiais SUS** (LEDI, SIGTAP, CNES, RNDS, etc.) — validação normativa (ainda a incorporar).

> Regra: comportamento encontrado no e-SUS = “esta versão implementa X”.  
> Não confundir automaticamente com norma legal vigente.

## Próximos documentos esperados

- Instruções mestres adicionais (quando enviadas) → gravar em `docs/pipeline/` ou `docs/conhecimento/`.
- Gap analysis TR × e-SUS × implementação → `docs/requisitos/gap-analysis.md`.
- Context packs por módulo → `contexts/<modulo>/`.

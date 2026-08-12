# Visão e objetivo do projeto SIGS

**Atualizado:** 2026-08-10

## Objetivo final

Construir um **Sistema Municipal Completo de Assistência à Saúde**, com arquitetura própria, capaz de atender a rede municipal e permanecer compatível com o ecossistema oficial do SUS.

Cobertura progressiva esperada (não exaustiva):

- Atenção Primária, UBS, ESF
- Cadastro de cidadãos, famílias, território, equipes
- Prontuário eletrônico, consultas, enfermagem
- Vacinação, odontologia, ACS/ACE
- Procedimentos, atenção domiciliar, atividades coletivas
- Agenda, prescrições, exames, encaminhamentos
- UPA, urgência/emergência, ambulatórios, especialidades
- Produção e faturamento SUS, auditoria
- Integrações federais, relatórios, regulação
- Demais módulos da operação municipal

## Fontes desta fase

1. **e-SUS APS** — especificação funcional/comportamental por engenharia reversa controlada (não é cópia de código).
2. **Termo de Referência / Anexo I (Franca/SP)** — 601 requisitos funcionais do SGS contratado (`docs/requisitos/`).

## Fase atual (desde 2026-08-10)

**Reescrita backend-first** do e-SUS APS + inclusões TR úteis, sem UI de produto.  
Ver: `docs/planejamento/estrategia-reescrita-fase1.md`.

### O que esta etapa NÃO deve produzir

- UI gráfica final / design system (aguarda Claude Design — fase 2)
- Cópia da arquitetura legada (packages Bridge/PEC do e-SUS)
- Módulos adiados: SAMU, Laboratorial/LIS, Transporte/TFD

### O que esta etapa DEVE produzir

- API/domínio modular (arquitetura própria)
- Matriz de rastreabilidade RF (Obrigatório/Desejável) com ganchos de faturamento
- Specs contínuas + implementação alinhada a `data/esus/.../spec/`
- Produção LEDI-ready testável a cada fatia parcial
- Manuais técnicos; manuais de usuário podem ficar stub até a UI

## Etapa anterior (pipeline de specs)

Ainda válida como fonte:

- Pipeline: inventário → decompilação seletiva → specs
- Context packs e proveniência
- Gap analysis TR × e-SUS

## Consumidor das especificações

O próprio monorepo `apps/api` (e futuros clientes UI).

## Nome do produto no TR

No edital/TR o sistema é referido como **SGS — Sistema de Gestão em Saúde** (Secretaria Municipal de Saúde de Franca/SP).  
Neste repositório o workspace chama-se **SIGS**; tratar como o mesmo produto-alvo salvo decisão contrária da equipe.

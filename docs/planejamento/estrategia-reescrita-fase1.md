# Estratégia — Fase de reescrita (sem UI final)

**Decisão:** 2026-08-10  
**Status:** ativa

## O que foi decidido

1. **Iniciar a reescrita do e-SUS APS completo** (arquitetura própria; specs como fonte, não cópia de código).
2. **Incluir cedo** itens do edital/TR que forem úteis ao núcleo (plataforma, auditoria, produção/faturamento mínimo, etc.), sem esperar o fim da reescrita APS.
3. **Sempre rastrear** o que é **Obrigatório** vs **Desejável** no TR, e o que é comportamento e-SUS vs lacuna TR.
4. Cada implementação parcial deve permitir **testes de faturamento/produção** (export LEDI-ready / BPA stub / trilha auditável).
5. **UI gráfica final fica para a 2ª fase** — trocar pela entrega do Claude Design. Nesta fase: API + shell mínimo técnico (Swagger/health), sem design system.

## Fora do esforço inicial APS (P0–P7)

- Laboratorial / LIS (M6) — ainda sem fonte equivalente no monorepo
- Transporte / TFD (M15)

## Stream paralelo reativado — SAMU (M5)

Com a pasta `Samu/` (e-SUS SAMU WebForms + `esus-samu.dll`), o módulo **SAMU deixa de ser “adiado sem fonte”** e passa ao **backlog de reescrita S0–S4**.

Detalhe: [conhecimento/12-samu-fonte-federal-backlog.md](../conhecimento/12-samu-fonte-federal-backlog.md).

Não misturar com o P0–P7 APS: SAMU é domínio próprio (ocorrência, frota, regulação pré-hospitalar).

## Duas fases de interface

| Fase | UI | Backend / domínio |
|---|---|---|
| **Agora** | Apenas OpenAPI/Swagger + health; sem telas de produto | Implementar módulos |
| **Depois** | Substituir/conectar UI do Claude Design (`docs/design/entregas/`) | Estável; só adaptar contratos se preciso |

## Fontes e prioridade

1. Specs e-SUS (`data/esus/5.5.24/spec/`) — comportamento a reescrever  
2. TR Anexo I — contrato municipal; marcar Obrigatório/Desejável  
3. Normas SUS (LEDI, SIGTAP, …) — validação antes de produção real  

## Rastreabilidade

Arquivo vivo: `docs/rastreabilidade/cobertura-rf.md` (+ CSV gerável).

Colunas mínimas por RF tocado:

- módulo / nº / tipo (Obrigatório|Desejável)
- fonte: `e-SUS` | `TR` | `ambos`
- status: `não iniciado` | `parcial` | `implementado` | `adiado`
- endpoint / módulo de código
- `teste_faturamento`: `n/a` | `previsto` | `automatizado`

## Ordem de implementação (backend-first)

```text
P0  Fundação: monorepo API, health, config, auditoria stub, matriz RF
P1  Organização: unidade, profissional, equipe, lotação
P2  Cidadão / território básico
P3  Agenda
P4  Atendimento APS + produção ficha individual (LEDI-ready)
P5  Vacinação + produção ficha vacina
P6  Odontologia / AD / coletivo (completar espelho APS)
P7  Lacunas TR ativas úteis: faturamento BPA stub, totem/painel depois, etc.
```

A cada P1–P5: **pacote testável de produção/faturamento** (mesmo que homologação/stub versionado).

## Stack (oficial)

Ver `docs/planejamento/stack-oficial.md`.

| Camada | Escolha |
|---|---|
| API | NestJS 11 + Prisma (como LeisMunicipais / Nexo) |
| Web | Next.js 15 (UI Claude Design na fase 2) |
| DB local | SQLite via Prisma; Postgres em deploy |
| Legado | `apps/api-python` deprecated |

Arquitetura própria (módulos Nest), não espelho Bridge/PEC.

## DoD ajustado nesta fase (sem UI final)

Feature “pronta” para merge nesta fase:

1. Código + testes automatizados críticos  
2. Entrada na matriz de rastreabilidade RF  
3. Manual técnico (versão)  
4. Manual usuário **pode** ficar stub “UI pendente — fase Design” até existir tela  
5. Gancho de produção/faturamento quando o módulo gerar produção SUS  

Quando a UI Claude Design entrar: completar link de ajuda in-app (DoD completo).

## Relação com o MVP antigo

O `plano-mvp.md` (1 UBS / ~12 semanas) continua válido como **primeiro marco operacional**.  
Esta estratégia **amplia** o horizonte para reescrita APS completa + inclusões TR, ainda backend-first.

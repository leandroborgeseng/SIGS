---
id: plataforma.central-ajuda
title: Central de Ajuda (técnico)
type: technical
module: plataforma
feature: help
version: 1.0.0
product_min: 0.1.0
status: draft
audience: [ti, sustentacao, desenvolvimento]
related_rf: [RF-1.17]
related_apis: [/help/articles, /help/articles/{articleId}]
updated_at: 2026-08-10
authors: [SIGS]
---

# Central de Ajuda — manual técnico

## Escopo

Servir artigos Markdown versionados (usuário e técnico) via API e UI.

## Modelo

- `id` estável (slug)
- `version` semver do conteúdo
- `type`: user | technical
- `status`: draft | published | deprecated
- Índice em `docs/manuais/*/ _index.yaml` (fonte) e/ou tabela `help_articles`

## APIs

Ver `contracts/openapi/sgs-mvp.openapi.yaml` — tags `help`.

## Permissões

- `help.user.read` — todos autenticados
- `help.technical.read` — role TI

## Auditoria

Leitura de manuais **não** precisa de log forense; publicação/alteração de artigo **sim**.

## Limites

MVP: Markdown estático + busca simples. Videoaulas = fase posterior.

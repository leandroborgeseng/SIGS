---
id: faturamento.funil-pre-envio
title: Funil pré-envio — passo a passo do lote LEDI
type: user
module: faturamento
feature: funil-pre-envio
version: 1.0.0
product_min: 0.2.0
status: published
audience: [gestor, faturamento, profissional, recepcao]
related_rf: [RF-10.3, RF-12.7]
related_screens:
  [
    /faturamento,
    /faturamento/lote/fai,
    /faturamento/lote/fao,
    /faturamento/lote/proc,
    /faturamento/lote/cadastro-individual,
    /faturamento/lote/domicilio,
    /faturamento/lote/coletivo,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Funil pré-envio — passo a passo

**Ajuda in-app:** `faturamento.funil-pre-envio`  
**Telas:** qualquer lote em `/faturamento/lote/…`

O SIGS **não envia sozinho** ao Ministério. Ele **abre, critica, corrige o que for seguro e separa** o que já pode ir do que ainda precisa de pessoa.

## Quem pode usar

Todos os usuários autenticados (gestão, faturamento, profissionais, recepção).

## Pré-requisitos

1. Rede municipal sincronizada em **Cadastros → Auditoria CNES** (unidades, profissionais e equipes).
2. ZIP **só com um tipo** de ficha (ex.: só FAO na tela de Lote FAO).
3. Nome do lote preenchido na etapa de upload.

## Passo a passo

1. **Upload** — Em `/faturamento`, abra o lote do tipo certo e solte o ZIP. O sistema avisa: correções automáticas entram sozinhas; o que exige pessoa fica para depois.
2. **Gate de tipo** — Se o ZIP for de outro tipo (ex.: FAO na tela FAI), a tela **recusa e para**. Não analisa. Volte ao início e abra o lote correto.
3. **Análise** — Contagens: quantidade de fichas, já podem enviar (**Pronto Siaps**), erros, quantos corrigem em lote vs individuais.
4. **Problema a problema** — Modal em sequência (do mais grave ao menos). Corrija em lote quando o botão permitir, ou deixe para individual.
5. **Fechamento** — Campos corrigidos + gráfico **antes × depois**. Três estados:
   - **Pronto Siaps** = pode ir ao governo (sem bloqueio de envio)
   - **Pronto Previne** = qualidade / indicador (financiamento)
   - **100% OK** = Siaps **e** Previne
6. **Dois ZIPs** — Baixe **aptos para envio** e **ainda precisam correção** (pendentes).
7. **Ficha a ficha** — O que restou de correção manual; depois volte ao fechamento se precisar.

## O que o funil **não** faz

- Não substitui o envio oficial ao Siaps/SISAB (você baixa o ZIP e envia pelo canal do município).
- Não inventa cadastro de pessoa ou vínculo de equipe — isso vem do cadastro mestre e das fichas 2/3.
- Vacina (tipo **14**) ainda sem lote ZIP nesta onda.

## Artigos relacionados

| Tema | Ajuda |
|---|---|
| O que é checado em cada tipo | `faturamento.regras-por-tipo` |
| Cruzamentos entre fichas | `faturamento.cruzamentos` |
| Siaps × Previne | `faturamento.siaps-vs-previne` |
| Hub | `faturamento.hub` |

## FAQ

**P: Pronto Siaps basta para o financiamento Previne?**  
**R:** Não. Siaps só abre a porta do envio. Previne depende de cadastro, vínculo com equipe e qualidade clínica. Veja `faturamento.siaps-vs-previne`.

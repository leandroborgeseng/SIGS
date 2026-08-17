---
id: faturamento.regras-por-tipo
title: O que o sistema checa em cada tipo de ficha
type: user
module: faturamento
feature: regras-por-tipo
version: 1.0.0
product_min: 0.2.0
status: published
audience: [gestor, faturamento, profissional]
related_rf: [RF-10.3, RF-12.7, RF-2.30]
related_screens:
  [
    /faturamento,
    /faturamento/lote/cadastro-individual,
    /faturamento/lote/domicilio,
    /faturamento/lote/fai,
    /faturamento/lote/fao,
    /faturamento/lote/coletivo,
    /faturamento/lote/proc,
    /faturamento/lote/visita-acs,
    /faturamento/lote/ad,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# O que é checado por tipo de ficha

**Ajuda in-app:** `faturamento.regras-por-tipo`

Em **toda** ficha LEDI o sistema olha o **cabeçalho** (CNES, equipe/INE, CNS e CBO do profissional, município/IBGE, UUID, origem). Sem rede municipal sincronizada, vários avisos de CNES/equipe ficam incompletos.

Legenda rápida:

| Na tela | Significado |
|---|---|
| Bloqueia envio (Siaps) | Sem corrigir, a ficha **não** deve ir no ZIP de aptos |
| Qualidade / Previne | Pode enviar, mas indicador ou auditoria sofrem |
| Autofix | O sistema pode corrigir sozinho quando for seguro |

## Tipo 2 — Cadastro Individual

| O que checa | Eixo |
|---|---|
| Nome, data de nascimento, sexo, nome da mãe (ou “Desconhece”) | Siaps (pessoa mínima) |
| CPF **ou** CNS válido | Siaps |
| Nacionalidade, raça/cor, etnia, deficiência, NIS | Previne / completude CDS |
| Vínculo pessoa ↔ equipe (INE) | Previne (denominador) |

**Tela de lote:** `/faturamento/lote/cadastro-individual` · origem operacional: `/pacientes`

## Tipo 3 — Cadastro Domiciliar

| O que checa | Eixo |
|---|---|
| Equipe, tipo de imóvel, logradouro, responsável | Siaps (CDS território) |
| Pessoa responsável existe no cadastro individual | Bloqueio CDS / qualidade |
| Microárea / família coerentes com visitas | Previne (C2–C6) |

**Tela:** `/faturamento/lote/domicilio` · origem: `/territorio`

## Tipo 4 — FAI (atendimento individual)

| O que checa | Eixo |
|---|---|
| `stNaoPossuiCpf` + CPF/CNS do cidadão | Siaps (autofix comum) |
| Tipo/local, CIAP/CID, condutas | Siaps |
| INE no cabeçalho | Previne (muito frequente faltar) |
| Turno, gestante, antropometria / PA | Previne (C*) |

**Tela:** `/faturamento/lote/fai` · fila: `/faturamento/aps`

## Tipo 5 — FAO (odontológico)

| O que checa | Eixo |
|---|---|
| `stNaoPossuiCpf`, CIAP/CID (`problemasCondicoes`) | Siaps |
| INE da eSB, CBO odonto | Siaps / Previne |
| Procedimentos e conduta de conclusão (ex. 1ª consulta, alta) | Previne bucal B1–B6 |
| Vigilância “outro” (99) em massa | Qualidade |

**Importante:** a FAO **não exige** ficha tipo 2 no mesmo ZIP para o Siaps aceitar. Para Previne, a pessoa precisa existir e estar vinculada à equipe.

**Tela:** `/faturamento/lote/fao` · fila: `/faturamento/odonto`

## Tipo 6 — Atividade coletiva

| O que checa | Eixo |
|---|---|
| Tipo, tema, público, nº de participantes | Siaps |
| Participantes identificados (CNS/CPF) | Previne |
| Procedimento de escovação supervisionada (B4) — **fora da FAO** | Previne |
| Faixa etária 6–12 anos quando for B4 | Previne |

**Tela:** `/faturamento/lote/coletivo` · origem: `/coletivo`

## Tipo 7 — Procedimentos

| O que checa | Eixo |
|---|---|
| Identidade (CPF/CNS + `stNaoPossuiCpf`), turno, CNES | Siaps |
| Código de procedimento: rejeitar códigos ABPG; preferir SIGTAP ativo | Siaps / Previne |
| Cabeçalho profissional × lotação | Siaps |

**Tela:** `/faturamento/lote/proc`

## Tipo 8 — Visita ACS

| O que checa | Eixo |
|---|---|
| Paciente e/ou domicílio, desfecho, motivos | Siaps |
| Turno; lat/long (quando houver) | Previne / qualidade |
| Visitas em janelas (ex. ≥2 VD com intervalo) | Previne (C2–C6) — motor completo ainda em evolução |

**Tela:** `/faturamento/lote/visita-acs` · origem: `/territorio`

## Tipo 10 — Atenção domiciliar (AD)

| O que checa | Eixo |
|---|---|
| Pelo menos um cidadão, modalidade AD, procedimento | Siaps |
| Continuidade AD1/AD2/AD3; CIAP/CID | Qualidade |
| Cabeçalho CNES/INE/CNS | Siaps |

**Tela:** `/faturamento/lote/ad` · origem: `/ad`

## Tipo 14 — Vacinação

| O que checa | Eixo |
|---|---|
| Imuno, estratégia, dose, lote, fabricante, via, local | Siaps (na tela `/vacinacao`) |
| Idade coerente com faixa do calendário | Previne (C2/C3/C6/C7) |

**Lote ZIP tipo 14:** ainda **não** disponível nesta onda — use a tela nativa de vacinação.

## Artigos relacionados

- Funil: `faturamento.funil-pre-envio`
- Cruzamentos: `faturamento.cruzamentos`
- Siaps × Previne: `faturamento.siaps-vs-previne`

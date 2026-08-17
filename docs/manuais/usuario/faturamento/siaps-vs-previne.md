---
id: faturamento.siaps-vs-previne
title: Siaps (envio) × Previne (financiamento)
type: user
module: faturamento
feature: siaps-vs-previne
version: 1.0.0
product_min: 0.2.0
status: published
audience: [gestor, faturamento, profissional, recepcao]
related_rf: [RF-10.3, RF-2.30, RF-12.7]
related_screens:
  [
    /faturamento,
    /ajuda,
    /pacientes,
    /aps,
    /odonto,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Siaps (envio obrigatório) × Previne (financiamento)

**Ajuda in-app:** `faturamento.siaps-vs-previne`  
**Convenção visual:** badge **vermelho Siaps** × **laranja Previne** nas fichas operacionais.

## Dois eixos de dinheiro (não misturar)

| Eixo | O que o governo usa | Se falhar |
|---|---|---|
| **A — Siaps / envio LEDI** | Fichas aceitas no Siaps/SISAB | Rejeição — atendimento **não** conta na produção enviada |
| **B — Previne Brasil** | Contagens e scores sobre produção **já aceita** + cadastro e vínculo | Indicador baixo → impacto no **repasse** por cumprimento |

Regra de ouro do SIGS:

> **Enviar bem (Siaps) é pré-requisito de pontuar bem (Previne).**  
> **Pronto Siaps ≠ Pronto Previne ≠ 100% OK.**

## Como aparece na tela

| Cor / badge | Significado | Finalizar / enviar |
|---|---|---|
| Vermelho **Siaps** | Obrigatório para envio legal | Sem isso, **não** finaliza atendimento / não entra no ZIP de aptos |
| Laranja **Previne** (ou Indicador) | Qualidade e financiamento | Orienta; **não** impede envio se Siaps estiver ok |
| Neutro | Clínico / uso local | Sem vínculo federal direto |

No wizard de lote, os mesmos três estados: Pronto Siaps · Pronto Previne · 100% OK.

## Cadastro individual “completo” — dois checklists

### Mínimo Siaps (pessoa contável)

- Nome civil  
- Data de nascimento  
- Sexo  
- Nome da mãe **ou** “Desconhece”  
- CPF **ou** CNS válido  
- Óbito preenchido se falecido  

### Completude Previne / CDS

- Nacionalidade (e IBGE de nascimento se brasileiro)  
- Raça/cor, etnia, deficiência, NIS  
- **Vínculo paciente ↔ equipe (INE)** + microárea  
- Membro de domicílio (tipo 3) quando couber  
- Condições ativas (gestação, diabetes, hipertensão…) quando a produção exige  
- Sem duplicata no Paciente Mestre  

**Completo Siaps ≠ completo Previne.**

## Exemplos do dia a dia

| Situação | Siaps | Previne |
|---|---|---|
| FAO sem CIAP/CID | Bloqueia | Também prejudica |
| FAO ok, mas cidadão sem cadastro individual / vínculo | Pode aceitar o XML | Denominador “vinculados” sofre |
| FAI sem INE | Em geral qualidade / risco | Indicadores C* distorcem |
| Escovação coletiva só na FAO | Errado lugar | B4 some — use coletivo (tipo 6) |
| PROC com código ABPG antigo | Bloqueia / risco | Procedimento não conta certo |

## O que fazer na prática

1. No atendimento (`/aps`, `/odonto`, `/vacinacao`…): preencha **vermelho** primeiro; use **laranja** para não perder indicador.  
2. No lote ZIP: baixe **aptos** só com Pronto Siaps; trate pendentes e olhe o painel Previne (ex. sinais B1–B6 na FAO).  
3. No cadastro: complete pessoa + vínculo em `/pacientes` e `/territorio` **antes** de esperar score alto.  
4. Na rede: sync CNES/PF/equipes — cabeçalho errado glosa os dois eixos.

## Artigos relacionados

- Funil: `faturamento.funil-pre-envio`
- Por tipo: `faturamento.regras-por-tipo`
- Cruzamentos: `faturamento.cruzamentos`
- Pacientes: `cadastros.pacientes`

---
id: faturamento.cruzamentos
title: Cruzamentos entre fichas, CNES e equipe
type: user
module: faturamento
feature: cruzamentos
version: 1.0.0
product_min: 0.2.0
status: published
audience: [gestor, faturamento, profissional]
related_rf: [RF-10.21, RF-10.3, RF-2.30]
related_screens:
  [
    /faturamento,
    /faturamento/auditoria,
    /cadastros/cnes-auditoria,
    /equipes,
    /pacientes,
    /territorio,
  ]
updated_at: 2026-08-16
authors: [SIGS]
---

# Cruzamentos entre fichas e cadastros

**Ajuda in-app:** `faturamento.cruzamentos`

O Siaps olha cada ficha **quase sozinha**. O financiamento Previne e a qualidade municipal pedem um **grafo**: pessoa ↔ equipe ↔ domicílio ↔ produção.

## Modelo mental (simples)

```text
Cadastro da rede (CNES · profissional · equipe)
        │
        ▼ cabeçalho de toda produção
Produção (4 FAI · 5 FAO · 6 coletivo · 7 PROC · 8 visita · 10 AD · 14 vacina)
        │
        ├──► Cadastro Individual (tipo 2)  ← quem é a pessoa
        └──► Domicílio (tipo 3)            ← onde mora / família
```

## O que o SIGS cruza hoje

### 1. Produção × rede municipal (CNES / INE / CNS / CBO)

| Cruzamento | Por quê |
|---|---|
| CNES da ficha na rede da Prefeitura e ativo | Evita unidade fora da gestão municipal |
| CNS do profissional lotado na unidade + CBO coerente | Evita glosa e indicador com CBO errado |
| INE da equipe existe e pertence ao CNES | Equipe “fantasma” distorce denominador |
| Profissional em mais de uma equipe sem INE claro | Ambiguuidade no cabeçalho |

**Onde ver:** `/cadastros/cnes-auditoria`, `/equipes`, `/faturamento/auditoria` e no próprio wizard de lote (após sync).

### 2. Produção × Cadastro Individual (tipo 2)

| Origem | Destino | O que importa |
|---|---|---|
| FAO, FAI, PROC, coletivo, visita, AD, vacina | Tipo 2 / Paciente Mestre | Pessoa da produção existe (CNS ou CPF) |
| Produção | Tipo 2 + vínculo NT 30 | Pessoa vinculada à **mesma equipe** do cabeçalho |
| Produção | Tipo 2 | Sexo/DN coerentes (ex.: gestante) |

**Siaps:** a FAO pode ir **sem** tipo 2 no ZIP.  
**Previne:** sem cadastro e vínculo, o indicador de “vinculados” fica baixo mesmo com XML aceito.

Códigos na auditoria (`/faturamento/auditoria`): `PRODUCAO_SEM_VINCULO_EQUIPE`, `PRODUCAO_INE_NEQ_VINCULO`, `CADASTRO_INCOMPLETO_SIAPS`, `CADASTRO_INCOMPLETO_PREVINE` — seção e CSV «vínculo/cadastro».

### 3. Cadastro Individual × Domicílio (2 × 3)

| Cruzamento | Por quê |
|---|---|
| Pessoa é membro/responsável de um domicílio ativo | Território e visitas ACS |
| Todo domicílio tem responsável válido no tipo 2 | Consistência CDS |

**Onde registrar:** `/territorio` e `/pacientes`.

### 4. Visita ACS × domicílio × pessoa (8 × 3 × 2)

A visita deve apontar para paciente e/ou domicílio existentes, com motivos e desfecho. Janelas de visita (ex. duas visitas com intervalo) alimentam scores Previne — o motor completo ainda evolui; o funil já critica o mínimo CDS.

### 5. Coletivo × B4 e Procedimentos × SIGTAP

- Escovação supervisionada (B4) é da ficha **coletiva (6)**, não da FAO.
- Procedimentos com código ABPG antigo devem migrar para SIGTAP — o lote PROC aponta isso.

## Onde agir na prática

| Sintoma | Onde corrigir |
|---|---|
| CNES/INE/CNS inconsistentes | Sync + auditoria CNES; lotação em `/lotacoes` |
| Pessoa sem cadastro / duplicata | `/pacientes` (Paciente Mestre) |
| Sem vínculo com equipe | `/territorio` |
| Produção clínica incompleta | Wizard do tipo + fila APS/odonto |
| Visão por competência | `/faturamento/auditoria` |

## Mensagem operacional

1. **Aceite Siaps** = ficha isolada + cabeçalho contra CNES.  
2. **Financiamento Previne** = pessoa (2) ↔ equipe ↔ domicílio (3) ↔ produção.  
3. Corrigir só `stNaoPossuiCpf` + CIAP na FAO **abre a porta**; sem cadastro, vínculo e procedimento certo o indicador continua baixo.

## Artigos relacionados

- Funil: `faturamento.funil-pre-envio`
- Por tipo: `faturamento.regras-por-tipo`
- Siaps × Previne: `faturamento.siaps-vs-previne`
- Auditoria: `faturamento.auditoria`

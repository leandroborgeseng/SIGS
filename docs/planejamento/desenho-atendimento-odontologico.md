# Desenho — Atendimento odontológico (SIGS)

**Status:** Onda 1 + Stream F / VOID + odontograma FDI+escopos + agenda dia (RF-12.1/12.12 parcial) + RF-12.13 + RF-12.11 histórico (copiar snapshot)  
**Atualizado:** 2026-08-13  
**Contexto:** uso solo → faturamento Siaps primeiro → depois UI clínica completa  
**Fontes:** Thrift FAO 5.5.24 · `ledi-fao.validator.ts` · `ledi-dental.mapper.ts` · `dental-odontogram.ts` · `dental-encounter-mapping.md` · RF-12 Anexo I · docs/conhecimento/15 · lote Franca

---

## 1. Objetivo do desenho

Substituir o stub `/odonto` por um **fluxo clínico** que:

1. Consulta o **comportamento legado e-SUS** (ficha odonto / FAO tipo 5) como spec, sem copiar código.
2. Garante **todos os campos obrigatórios de faturamento (eixo A — Siaps)** no momento do **fechamento**.
3. Orienta (sem bloquear envio) os campos de **qualidade Previne ESB (eixo B)**.
4. Reusa o motor já existente: `buildDentalLediPayload` → `validateFaoJson` → `ProductionBatch` (+ futuro ZIP LEDI).
5. Permite **entrada a partir da agenda do dia** (`/odonto/agenda` · `AppointmentSlot` → `DentalEncounter.appointmentId`).

**Não-objetivo nesta fase:** agenda TR completa (tipos de item, multi-grade), prótese, telemonitoramento, atestados, odontograma rico (RF-12.10–20) — entram em ondas posteriores.

---

## 2. Dois eixos (contrato de produto)

| Eixo | Gate | Onde |
|---|---|---|
| **A — Envio / Siaps** | zero `BLOCKER` no validador FAO | botão **Finalizar e faturar** |
| **B — Previne ESB** | avisos B1–B6 / INE / vigilância ≠ 99 | painel lateral; não impede ZIP se A ok |

Regra: *enviar bem (A) é pré-requisito de pontuar (B).*

---

## 3. Fluxo clínico (legado → SIGS)

```text
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ 1. Identificar │ → │ 2. Abrir     │ → │ 3. Registrar     │ → │ 4. Fechar     │
│ paciente     │    │ atendimento │    │ clínico + LEDI  │    │ + faturar     │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
        │                  │                      │                     │
   Paciente Mestre    Lotação ativa         Seções da tela         validateFaoJson
   CPF/CNS/st CPF     CNES+CBO+INE+CNS      (ver §5)               ProductionBatch
```

### Estados do `DentalEncounter`

| Status | Significado |
|---|---|
| `OPEN` | Em atendimento |
| `FINISHED` | Fechado clinicamente + payload LEDI gerado |
| `VOID` | Anulado (não fatura; audit) |

Não há “rascunho LEDI” separado: o **finish** é o momento de serializar a FAO.

---

## 4. Mapa de campos — obrigatórios de faturamento (eixo A)

Fonte canônica: `ledi-fao.validator.ts` + Thrift `FichaAtendimentoOdontologico*`.  
Tela deve **impedir finish** se qualquer item A faltar (mesma mensagem do registry).

### 4.1 Contexto (header / lotação) — preenchido na abertura ou sessão

| Campo LEDI | UI | Obrigatório A | Origem / regra |
|---|---|---|---|
| `uuidFicha` | gerado | sim | `CNES(7)-UUID` 36–44 |
| `tpCdsOrigem` | oculto | sim | sempre `3` |
| `profissionalCNS` | lotação | sim | CNS válido |
| `cboCodigo_2002` | lotação | sim | CBO odonto/ASB/TSB (`FAO_ALLOWED_CBOS`) |
| `cnes` | unidade | sim | 7 dígitos |
| `ine` | lotação | **recomendado A / forte B** | obrigar se equipe eSB Franca |
| `codigoIbgeMunicipio` | unidade | sim | Franca `3516200` |
| `dataAtendimento` | data | sim | date do atendimento |

### 4.2 Cidadão — bloco identificação

| Campo LEDI | UI | Obrigatório A |
|---|---|---|
| `cpfCidadao` **XOR** `cnsCidadao` | paciente | sim (ou st + justificativa) |
| `stNaoPossuiCpf` | checkbox | sim (boolean) |
| `justificativaNaoPossuiCpf` | select 1–13,99 | se st=true |
| `dtNascimento` | paciente | sim |
| `sexo` | paciente | sim (`0`/`1`) |

### 4.3 Atendimento — bloco principal (equivalente tela e-SUS)

| Campo LEDI | UI | Obrigatório A | Notas |
|---|---|---|---|
| `tipoAtendimento` | select 2\|4\|5\|6 | sim | Default operacional Franca/consulta: **5** |
| `tiposConsultaOdonto` | multi/select | **condicional** | Obrigatório se tipo=**2**; proibido se tipo=**4**; máx 1 |
| `localAtendimento` | select 1–10 | sim | Default `1` UBS |
| `turno` | 1\|2\|3 | sim | Default `2` tarde |
| `gestante` | sim/não | sim | Bloquear true se sexo M |
| `dataHoraInicialAtendimento` | hora | sim | |
| `dataHoraFinalAtendimento` | hora | sim | ≥ inicial |
| `necessidadesEspeciais` | sim/não | não BLOCKER | mapear se UI expuser |

### 4.4 Condutas (`tiposEncamOdonto`) — ≥1

Usar catálogo API `LEDI_CONDUTA_ODONTO` (não o catálogo desalinhado da UI lote).

| Código | Label (API) | Regra cruzada |
|---|---|---|
| 15 | Tratamento concluído | exige `tiposConsultaOdonto` ∈ {1,2} |
| 16 | Retorno agendado | — |
| 17 | Alta do episódio | incompatível com consulta 1 ou 2 |
| … | demais do enum | ≥1, ≤17 itens |

### 4.5 Vigilância saúde bucal — ≥1 (RF-12.7)

| id | Label |
|---|---|
| 1–7 | Abscesso … Outro (catálogo dental) |

Evitar default **99** em massa (qualidade Previne / lote Franca).

### 4.6 Problemas/condições — ≥1 (FAO#26)

Cada item: **CIAP e/ou CID-10**. UI: busca (já existe `CodeSearchSelect` no lote).

### 4.7 Procedimentos SIGTAP

| Regra | Severidade A |
|---|---|
| Lista vazia | não BLOCKER (recomendado) |
| Código `0301040079` (escuta) | **BLOCKER** — usar tipo=4 |
| Duplicata | **BLOCKER** |
| `quantidade` ≥ 1 | MONEY_RISK |

### 4.8 Checklist mínimo “Finalizar e faturar” (tipo 5)

1. Lotação completa (CNS + CBO odonto + CNES + IBGE; INE se eSB)  
2. Paciente identificável (CPF XOR CNS + st coerente; nasc; sexo)  
3. tipo=5 (ou outro válido com regras), local, turno, gestante, horas  
4. ≥1 conduta · ≥1 vigilância · ≥1 problema  
5. Procedimentos sem escuta/duplicata  
6. `validateFaoJson` → 0 BLOCKER → grava `FINISHED` + `ProductionBatch`

---

## 5. Layout de telas (fase clínica mínima)

### Tela A — Lista / fila do dia
- Filtro unidade + profissional  
- Atendimentos `OPEN` / `FINISHED` do dia  
- CTA **Novo atendimento**

### Tela B — Atendimento (uma página, seções colapsáveis)

| Seção | Conteúdo | Gate |
|---|---|---|
| **Cabeçalho** | Paciente, unidade, lotação, data | A |
| **Identificação** | CPF/CNS/st/justificativa (editar se gap) | A |
| **Tipo e contexto** | tipoAtendimento, consulta (se 2), local, turno, gestante, horas | A |
| **Clínico leve** | Anamnese (texto) · **catálogo SIGTAP predefinido** no odontograma (FDI/Q/S/BOCA/`done`) · `odontogramJson` + `region` · **histórico RF-12.11** (snapshots anteriores + copiar para o atual, mesma unidade) | A |
| **Problemas** | CIAP/CID (≥1) | A |
| **Vigilância** | multi 1–7 (≥1) | A |
| **Condutas / desfecho** | multi enum odonto (≥1) + regras 15/17 | A |
| **Fornecimentos** | opcional (RF-12.8; não BLOCKER hoje) | depois |
| **Painel LEDI** | contagem BLOCKER / WARN / Previne ao vivo | A+B |
| **Ações** | Salvar rascunho (só domínio) · **Finalizar e faturar** · Anular | |

Validação **ao vivo** (mesmo validador do lote) enquanto preenche — UX igual ao “guia de erros”, mas na origem.

### Tela C — Pós-fechamento
- Resumo Siaps-ready  
- Link para incluir em lote ZIP / production batch  
- Audit trail

---

## 6. Domínio de dados (evolução do Prisma)

**Manter** `DentalEncounter` como agregado, mas **sair de JSON cego** no finish:

| Hoje | Proposta (onda 1) |
|---|---|
| `proceduresJson` | tipar DTO + validar SIGTAP no finish |
| `outcomesJson` | persistir `tiposEncamOdonto[]` + vigilância + problemas no encounter **antes** do finish |
| Campos LEDI só no `FinishDto` | campos A editáveis durante `OPEN` (patch) |
| Lotação implícita | `assignmentId` / CNS+CBO+INE obrigatórios na abertura |

Onda 2 (TR): tabelas/odontograma, prótese, patologias — sem bloquear faturamento.

---

## 7. Alinhamento RF-12 (Obrigatório TR)

| RF | Matriz (Stream E) | Nota |
|---|---|---|
| 12.2 Profissional | **coberto** | lotação UI + `assignmentId` |
| 12.3 Paciente | **coberto** | identificação |
| 12.4 Início tratamento | parcial | status/campo |
| 12.5 Tipo atendimento | **coberto** | default 5 |
| 12.6 Conduta/desfecho | **coberto** | `LEDI_CONDUTA_ODONTO` |
| 12.7 Vigilância | **coberto** | finish + preview |
| 12.8 Fornecimentos | **coberto** | UI + mapper (não BLOCKER) |
| 12.9 Anamnese | **coberto** | texto livre |
| 12.1 Agenda | parcial | só abertura encounter |
| 12.11 | **coberto** | timeline + snapshot na ficha; PATCH copia odontogramJson + procs `done` (mesmo paciente/unidade; sem VOID; não sobrescreve VOID/COMPLETED) |
| 12.12 | parcial | odontograma FDI + Q/S/BOCA (ficha + careJson/LEDI `odontograma` + proc. region); gap Thrift FAO sem tooth/region |
| 12.13 | **coberto** | catálogo predefinido + `done`; FAO só realizados |
| 12.13 / 12.16 / 12.20 | parcial | procs predefinidos / CIAP-CID / lista |
| 12.10, 14–15, 17–19 | não iniciado | tele, prótese, exames, atestados |

---

## 8. Legado e-SUS (o que consultar na implementação)

| Artefato | Uso |
|---|---|
| Thrift `FichaAtendimentoOdontologicoMaster/Child` | schema de campos |
| ValidationGroups / enums odonto (functional map) | listas canônicas |
| Spec `dental-encounter-mapping.md` | domínio → JSON |
| Tela PEC odonto (comportamento) | ordem de campos / obrigatoriedade condicional |
| Lote Franca 5974691 | defaults e anti-padrões (st CPF, problemas, vigilância 99) |

Princípio: **specs + validadores SIGS** como fonte de verdade; legado só para paridade de enums e regras.

---

## 9. Ondas de entrega

### Onda 1 — “Atendimento que fatura” (prioridade)
1. Persistência dos campos A no encounter (patch enquanto OPEN)  
2. UI `/odonto/[id]` com seções §5 + painel validador ao vivo  
3. Finish → 0 BLOCKER obrigatório (`enforceFaoConformity=true` default)  
4. Catálogo único de condutas (alinhar UI lote × `LEDI_CONDUTA_ODONTO`)  
5. Defaults Franca na abertura (IBGE, turno, local, CBO)  
6. Manual usuário stub + matriz RF-12.2–12.7 / 12.9  

### Onda 2 — Qualidade Previne na origem
- [x] Alertas B1–B6 + qualidade na ficha/`preview-fao` (Stream F; não BLOCKER Siaps)
- [x] Desencorajar vigilância 99 (warning + catálogo)
- [ ] Procedimento 1ª consulta programada quando fluxo “primeira consulta” (UX dedicada)

### Onda 3 — TR clínico rico + design fase 2
- Agenda, odontograma, prótese, patologias, atestados  
- Entrega Claude Design

---

## 10. Critérios de aceite (onda 1)

Checklist factual pós Streams A–D (`84e50f5` / `62e71a4`):

- [x] Abrir atendimento com **lotação UI** (`assignmentId` via `GET /v1/assignments`) e paciente válidos  
- [x] Preencher campos A; **debounce ~900ms** → PATCH rascunho + `preview-fao` (`validateFaoJson`)  
- [x] **CodeSearchSelect** para CIAP/CID na ficha `/odonto/[id]` (e no lote FAO)  
- [x] Finish cria `ProductionBatch` e JSON/XML FAO no fluxo de faturamento  
- [x] Finish incompleto lista códigos do registry (mesmo catálogo do lote)  
- [x] **Tela C** pós-fechamento + deep-link fila (`encounterId` / `batchId`)  
- [x] **VOID rascunho** (`IN_PROGRESS`) + **VOID local pós-`COMPLETED`** (`acknowledgeLocalOnly`; sem recall Ministério)  
- [x] Paths canônicos: `/faturamento`, `/faturamento/odonto`, `/faturamento/lote/fao` (aliases redirecionam)  
- [x] Condutas = `LEDI_CONDUTA_ODONTO` (sem códigos inventados / sem R$ na UI de risco)  
- [x] Sem dados reais de paciente em fixtures  
- [x] VOID local pós-`COMPLETED` (batch `error` + audit; limite §12)  
- [x] Onda 2 / Stream F — Previne na origem (painel B1–B6 + vigilância 99)

---

## 11. Decisões aprovadas (2026-08-12)

| # | Decisão | Valor |
|---|---|---|
| 1 | Default `tipoAtendimento` na abertura | **5** (consulta no dia) |
| 2 | INE na abertura | **Obrigatório agora (Franca)**; depois **parametrizável** por município/instalação (`requireIneOnDentalOpen` / config org) para outras cidades |
| 3 | Fornecimentos (`tiposFornecimOdonto`) | **Entram na Onda 1** (RF-12.8) |

**Status:** Onda 1 **aprovada para implementação**.

---

## 12. Stream B — gaps clínicos (2026-08-12) + F / VOID (atualizado)

Implementado na UI/API:

| Item | Situação |
|---|---|
| Lotação na abertura (`assignmentId`) | UI `/odonto` escolhe lotação/equipe via `GET /v1/assignments` |
| CIAP/CID com busca | `CodeSearchSelect` em `/odonto/[id]` |
| Validação ao vivo | debounce ~900ms → PATCH rascunho + `preview-fao` |
| Tela C pós-fechamento | card resumo + links fila/lote/lista |
| VOID rascunho | `POST …/void` se `IN_PROGRESS` → VOID + batch `error` |
| VOID pós-`COMPLETED` | `POST …/void` com `acknowledgeLocalOnly=true` → VOID + batch `error` + audit; **sem** recall Ministério |
| Stream F — Previne na origem | `preview-fao` devolve `previne` / `vigilanciaOnly99`; painel B1–B6 na ficha; **não** BLOCKER Siaps |

### Limite documentado (não fingir estorno remoto)

- Anulação pós-`COMPLETED` é **local**: encounter `VOID`, `ProductionBatch` → `status=error` (sai da fila `ready`), audit `void` com `ministryRecall: false`.
- Se o batch já estiver `sent` / XML já tiver ido ao Siaps/Ministério, o SIGS **não** gera XML de exclusão nem recall — o operador usa canais oficiais.
- Condutas lote = LEDI + UI sem R$ → **feito** (Stream D).
- Motor Previne = `analyzePrevineEsbXray` + registry LEDI existente (sem motor paralelo).

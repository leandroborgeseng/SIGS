# Specs extraídas — patient / encounter / vaccination

**Data:** 2026-08-10  
**Método:** decompilação seletiva CFR dos JARs P0 + leitura de formulários, enums, validators e services.

## JARs decompilados nesta rodada

`model`, `cds.common.api`, `cds.service.api`, `cds.service.impl`, `pec.common.api`, `pec.business.impl`, `pec.persistence`, `core.validation`, `validation`, `pec-ledi-thrift` — ~3927 arquivos `.java` em `data/esus/5.5.24/decompiled/raw/`.

## Onde estão as specs

| Módulo | Spec | Context pack |
|---|---|---|
| Paciente | `data/esus/5.5.24/spec/patient/` | `contexts/patient/` |
| Atendimento | `data/esus/5.5.24/spec/encounter/` | `contexts/encounter/` |
| Agenda (parcial) | `data/esus/5.5.24/spec/appointment/` | `contexts/appointment/` |
| Vacinação | `data/esus/5.5.24/spec/vaccination/` | `contexts/vaccination/` |

## Achados-chave

### Paciente
- Formulário rico com validações condicionais (mãe/pai desconhecido, óbito, orientação sexual, identidade de gênero, exterior).
- Serviço com lookup CPF/CNS/UUID e unificação.

### Atendimento
- Entidade `TB_ATEND` com status de fila e vínculo a agenda/prontuário/equipe.
- Ficha CDS individual separada (produção LEDI) com antropometria, gestação, condutas obrigatórias.
- Detecção de cidadão já na fila do dia (+ registro tardio 7 dias).

### Vacinação
- Master/child até 99 indivíduos; linhas de vacina com regras ESPECIAL (CBO+CID), BCG (hanseníase), pesquisa ANVISA, charset do lote.
- Estratégias alinhadas a códigos LEDI.
- Cancelamento e lookup de faixa etária no service.

## Próximo aprofundamento sugerido

1. `EnderecoCidadaoForm` + cadastro individual/domiciliar
2. Transições completas de status de atendimento (outros services)
3. Mapper LEDI thrift vacinação/atendimento individual campo a campo
4. Entidades JPA `Cidadao`, `Prontuario`, `Agendado`

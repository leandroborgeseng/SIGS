# Cobertura LEDI — erros e caminho de correção (P0)

**Atualizado:** 2026-08-12  
**Fonte:** `apps/api/src/care-extra/ledi-error-registry.ts` (espelho em `apps/web/src/lib/ledi/error-registry.ts`)  
**Gate CI:** `ledi-error-registry.spec.ts`

## Resumo

| Métrica | Valor |
|---|---:|
| Total de códigos | 78 |
| auto | 28 |
| semi | 6 |
| individual | 24 |
| reexport | 12 |
| info | 8 |
| pending implement (fixer/UI) | 8 |

**Pending (caminho planejado, UI trata como individual até P1/P2):**  
`CONDUTAS_MAX`, `JUSTIFICATIVA_CPF_UNEXPECTED`, `PROC_QTD`, `TIPO_CONSULTA_MULTI`, `TP_CDS_ORIGEM_MISSING`, `TP_CDS_ORIGEM_NOT_3`, `UUID_FICHA_LENGTH`, `VIGILANCIA_MAX`

## Legenda repairClass (A–E)

| Classe | Significado |
|---|---|
| auto | Correção automática segura (um clique / lote) |
| semi | Precisa de 1 valor na UI, depois aplica em lote |
| individual | Edição por ficha |
| reexport | Só origem / outro tipo de lote |
| info | Orientação Previne / qualidade |

## Matriz

| Código | Severity | Classe | Impl. | Título |
|---|---|---|:---:|---|
| `ALTA_EPISODIO_RULE` | BLOCKER | individual | sim | Alta do episódio sem regra de consulta |
| `ATENDIMENTOS_EMPTY` | BLOCKER | reexport | sim | Ficha sem nenhum atendimento |
| `ATENDIMENTOS_MAX` | MONEY_RISK | reexport | sim | Ficha com pacientes demais |
| `CBO_MISSING` | BLOCKER | auto | sim | Falta a ocupação do profissional |
| `CBO_NOT_ODONTO` | BLOCKER | auto | sim | Ocupação não é de saúde bucal |
| `CNES_FORMAT` | MONEY_RISK | auto | sim | Código da unidade com formato errado |
| `CNES_MISSING` | BLOCKER | auto | sim | Falta o código da unidade de saúde |
| `CNS_INVALID` | BLOCKER | individual | sim | Cartão do cidadão inválido |
| `CONDUTAS_MAX` | MONEY_RISK | semi | não | Condutas em excesso |
| `CONDUTAS_MISSING` | BLOCKER | individual | sim | Falta a conduta / encaminhamento |
| `CPF_CNS_BOTH` | BLOCKER | individual | sim | CPF e cartão do cidadão juntos |
| `CPF_INVALID` | BLOCKER | individual | sim | CPF do cidadão inválido |
| `DATA_ATENDIMENTO_MISSING` | BLOCKER | individual | sim | Falta a data do atendimento |
| `DT_NASCIMENTO_MISSING` | BLOCKER | individual | sim | Falta a data de nascimento |
| `FAI_ATENDIMENTO_MISSING` | BLOCKER | reexport | sim | FAI sem atendimento |
| `FAI_ROOT_NOT_FOUND` | BLOCKER | reexport | sim | Ficha individual incompleta |
| `FAO_ROOT_NOT_FOUND` | BLOCKER | reexport | sim | Ficha odontológica incompleta |
| `FORMAT_DADO_TRANSPORT` | BLOCKER | reexport | sim | Envelope sem a ficha odontológica dentro |
| `FORMAT_FHIR_NOT_FAO` | BLOCKER | reexport | sim | Arquivo do tipo errado (não é ficha odontológica) |
| `GESTANTE_MISSING` | BLOCKER | auto | sim | Falta informar se é gestante |
| `GESTANTE_SEXO_MASC` | BLOCKER | individual | sim | Marcado gestante com sexo masculino |
| `HORA_FIM_ANTES_INI` | BLOCKER | individual | sim | Fim do atendimento antes do início |
| `HORA_FIM_MISSING` | BLOCKER | individual | sim | Falta o horário de fim |
| `HORA_INI_ANTES_DATA` | MONEY_RISK | individual | sim | Início do atendimento antes da data do cabeçalho |
| `HORA_INI_MISSING` | BLOCKER | individual | sim | Falta o horário de início |
| `IBGE_FORMAT` | MONEY_RISK | auto | sim | Código do município inválido |
| `IBGE_MISSING` | MONEY_RISK | auto | sim | Falta o código do município |
| `INE_MISSING` | QUALITY_WARN | auto | sim | Falta o código da equipe |
| `JUSTIFICATIVA_CPF_MISSING` | BLOCKER | auto | sim | Falta justificativa de não ter CPF |
| `JUSTIFICATIVA_CPF_UNEXPECTED` | MONEY_RISK | semi | não | Justificativa de CPF sem marcar “não possui” |
| `LOCAL_ATENDIMENTO` | BLOCKER | auto | sim | Local do atendimento inválido |
| `PATIENT_ID_MISSING` | BLOCKER | individual | sim | Paciente sem identificação |
| `PREVINE_B1_NO_FIRST_CONSULTA` | MONEY_RISK | auto | sim | Sem primeira consulta programada (indicador B1) |
| `PREVINE_B2_NO_CONCLUSAO` | MONEY_RISK | auto | sim | Sem tratamento concluído (indicador B2) |
| `PREVINE_B2_NO_PAIR` | INFO | info | sim | Sem início nem conclusão de tratamento (B2) |
| `PREVINE_B3_HIGH_EXODONTIA` | MONEY_RISK | info | sim | Muita extração de dente (indicador B3) |
| `PREVINE_B3_LOW_EXODONTIA_SHARE` | QUALITY_WARN | info | sim | Pouca extração neste recorte (B3) |
| `PREVINE_B3_NO_EXODONTIA` | INFO | info | sim | Sem extração de dente neste atendimento (B3) |
| `PREVINE_B4_NOT_IN_FAO` | INFO | info | sim | Escovação em grupo não entra nesta ficha (B4) |
| `PREVINE_B5_HIGH_PREVENTIVE` | QUALITY_WARN | info | sim | Prevenção muito alta neste recorte (B5) |
| `PREVINE_B5_LOW_PREVENTIVE` | MONEY_RISK | auto | sim | Pouca prevenção no atendimento (B5) |
| `PREVINE_B5_NO_PREVENTIVE` | MONEY_RISK | auto | sim | Sem ações de prevenção (indicador B5) |
| `PREVINE_B5_NO_PROCS` | QUALITY_WARN | info | sim | Sem procedimentos para estimar prevenção (B5) |
| `PREVINE_B6_NO_ART` | MONEY_RISK | auto | sim | Restauração sem técnica ART/TRA (indicador B6) |
| `PREVINE_B6_NO_RESTORATIVE` | INFO | info | sim | B6 não se aplica neste atendimento |
| `PREVINE_CBO_NOT_ESB` | MONEY_RISK | auto | sim | Ocupação fora da equipe de saúde bucal |
| `PREVINE_INE_MISSING` | MONEY_RISK | auto | sim | Equipe sem código (impacto no Previne) |
| `PREVINE_PROBLEMAS_MISSING` | MONEY_RISK | auto | sim | Sem diagnóstico (qualidade Previne) |
| `PREVINE_VIGILANCIA_99` | QUALITY_WARN | auto | sim | Vigilância só como “outro” |
| `PROBLEMA_SEM_CODIGO` | BLOCKER | auto | sim | Problema sem código clínico |
| `PROBLEMAS_MISSING` | BLOCKER | auto | sim | Falta o problema ou diagnóstico |
| `PROC_ATENDIMENTO_MISSING` | BLOCKER | reexport | sim | Procedimentos sem atendimento |
| `PROC_CODE_ABPG` | BLOCKER | individual | sim | Código ABPG não é SIGTAP |
| `PROC_CODE_EMPTY` | MONEY_RISK | individual | sim | Procedimento sem código |
| `PROC_CODE_FORMAT` | MONEY_RISK | individual | sim | Código de procedimento com formato inválido |
| `PROC_DUPLICATE` | BLOCKER | individual | sim | Mesmo procedimento repetido |
| `PROC_ESCUTA_FORBIDDEN` | BLOCKER | individual | sim | Escuta inicial lançada no lugar errado |
| `PROC_QTD` | MONEY_RISK | semi | não | Quantidade do procedimento inválida |
| `PROC_ROOT_NOT_FOUND` | BLOCKER | reexport | sim | Ficha de procedimentos incompleta |
| `PROF_CNS_INVALID` | MONEY_RISK | individual | sim | Cartão do profissional com número inválido |
| `PROF_CNS_MISSING` | BLOCKER | individual | sim | Falta o cartão do profissional (CNS) |
| `SEXO_INVALID` | BLOCKER | individual | sim | Sexo inválido ou ausente |
| `ST_NAO_POSSUI_CPF` | BLOCKER | auto | sim | Falta dizer se o cidadão tem CPF |
| `TIPO_ATENDIMENTO` | BLOCKER | individual | sim | Tipo de atendimento inválido |
| `TIPO_CONSULTA_FORBIDDEN` | BLOCKER | individual | sim | Tipo de consulta não permitido neste atendimento |
| `TIPO_CONSULTA_MULTI` | MONEY_RISK | semi | não | Mais de um tipo de consulta |
| `TIPO_CONSULTA_REQUIRED` | BLOCKER | auto | sim | Falta o tipo de consulta odontológica |
| `TIPO_CONSULTA_URGENCIA` | BLOCKER | individual | sim | Consulta incompatível com urgência |
| `TP_CDS_ORIGEM_MISSING` | BLOCKER | auto | não | Falta informar de qual sistema veio a ficha |
| `TP_CDS_ORIGEM_NOT_3` | MONEY_RISK | auto | não | Origem do sistema diferente do esperado |
| `TRATAMENTO_CONCLUIDO_RULE` | BLOCKER | auto | sim | Tratamento concluído sem tipo de consulta adequado |
| `TURNO` | BLOCKER | auto | sim | Turno inválido ou ausente |
| `UUID_FICHA_LENGTH` | MONEY_RISK | semi | não | Número único da ficha com tamanho errado |
| `UUID_FICHA_MISSING` | BLOCKER | reexport | sim | Ficha sem número único de identificação |
| `VIGILANCIA_MAX` | MONEY_RISK | semi | não | Vigilância com itens demais |
| `VIGILANCIA_MISSING` | BLOCKER | auto | sim | Falta a vigilância em saúde bucal |
| `WRONG_FICHA_TIPO` | BLOCKER | reexport | sim | Tipo de ficha errado nesta tela |
| `XML_PARSE_ERROR` | BLOCKER | reexport | sim | Arquivo quebrado ou incompleto |

## Manutenção

1. Novo finding no validador → **obrigatório** adicionar em `ledi-error-registry.ts` (API) e espelhar na web.
2. Rodar `npm test --workspace=@sigs/api -- ledi-error-registry`.
3. Atualizar esta doc (ou regenerar com o mesmo script do P0).

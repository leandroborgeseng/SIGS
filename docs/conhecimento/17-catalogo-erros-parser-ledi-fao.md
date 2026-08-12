# Catálogo de erros do parser LEDI FAO + Previne

**Atualizado:** 2026-08-12  

**Fonte de verdade na UI:** `apps/web/src/app/odonto/lote/error-catalog.ts`  

**Parsers:** `ledi-fao.validator.ts` · `ledi-fao-previne-xray.ts` · lote (`WRONG_FICHA_TIPO`)


Severidades: **BLOCKER** (bloqueia Siaps) · **MONEY_RISK** (aceite/indicador em risco) · **QUALITY_WARN** · **INFO**.


## Lote / tipo de ficha

| Código | Sev | O que é | Por quê | Como corrigir |
|---|---|---|---|---|
| `WRONG_FICHA_TIPO` | BLOCKER | Tipo de ficha errado nesta tela | O arquivo é FAI (4), Procedimentos (7) ou outro tipo — não FAO (5). A tela /odonto/lote só corrige odonto. | Separe os lotes: FAO aqui; FAI/Procedimentos em fluxos próprios. |

## LEDI / Siaps (envio)

| Código | Sev | O que é | Por quê | Como corrigir |
|---|---|---|---|---|
| `ALTA_EPISODIO_RULE` | BLOCKER | Alta do episódio sem regra de consulta | Conduta de alta do episódio exige combinação válida com tiposConsultaOdonto. | Ajustar conduta e tipo de consulta conforme FAO#8. |
| `ATENDIMENTOS_EMPTY` | BLOCKER | Sem atendimentos odontológicos | A ficha master precisa de 1–99 children atendimentosOdontologicos. | Incluir ao menos um bloco de atendimento no XML. |
| `ATENDIMENTOS_MAX` | MONEY_RISK | Mais de 99 atendimentos | Limite LEDI FAO: no máximo 99 children por ficha. | Dividir em mais de uma ficha/master. |
| `CBO_MISSING` | BLOCKER | CBO ausente | Sem CBO 2002 a ficha não identifica a ocupação elegível para FAO. | Informar cboCodigo_2002 na lotação (ex. 223208). |
| `CBO_NOT_ODONTO` | BLOCKER | CBO não permite FAO | O CBO informado não está na Tabela 4 (CBOs que podem registrar FAO — CD/TSB/ASB). | Trocar para CBO 2232xx ou 3224xx permitido na FAO. |
| `CNES_FORMAT` | MONEY_RISK | CNES com formato inválido | LEDI exige CNES com exatamente 7 dígitos (ex.: 8 dígitos do legado falham). | Usar o CNES oficial de 7 dígitos da unidade. |
| `CNES_MISSING` | BLOCKER | CNES ausente | Produção APS precisa do CNES da unidade no header. | Preencher cnes / cnesDadoSerializado com 7 dígitos. |
| `CNS_INVALID` | BLOCKER | CNS do cidadão inválido | CNS falha no módulo 11 — tipicamente erro de digitação no legado. | Corrigir CNS no cadastro ou usar CPF válido. |
| `CONDUTAS_MAX` | MONEY_RISK | Demasiadas condutas | Limite de itens em tiposEncamOdonto foi excedido (máx. 17). | Reduzir a lista de condutas ao essencial. |
| `CONDUTAS_MISSING` | BLOCKER | Condutas (tiposEncamOdonto) ausentes | É obrigatório registrar ao menos uma conduta/encaminhamento odonto. | Incluir tiposEncamOdonto (códigos 1–17). |
| `CPF_CNS_BOTH` | BLOCKER | CPF e CNS juntos | Regra FAO: no mesmo atendimento informe CPF **ou** CNS, nunca os dois. | Manter só um identificador (preferência local/CNS). |
| `CPF_INVALID` | BLOCKER | CPF inválido | O CPF falha no algoritmo de dígitos verificadores. | Corrigir cadastro do cidadão ou usar CNS válido. |
| `DATA_ATENDIMENTO_MISSING` | BLOCKER | dataAtendimento ausente | Header exige a data do atendimento (competência da produção). | Preencher dataAtendimento (epoch ms) no headerTransport. |
| `DT_NASCIMENTO_MISSING` | BLOCKER | Data de nascimento ausente | dtNascimento é obrigatória no atendimento individualizado. | Exportar data de nascimento do cadastro do cidadão. |
| `FAO_ROOT_NOT_FOUND` | BLOCKER | Raiz sem FAO | A raiz XML não contém uuidFicha + headerTransport + atendimentosOdontologicos. | Envie XML FAO completo (não só um fragmento). |
| `FORMAT_DADO_TRANSPORT` | BLOCKER | Envelope sem FAO reconhecível | Há dadoTransporte, mas o validador não achou fichaAtendimentoOdontologicoMaster embutida. | Confirme tipoDadoSerializado=5 e a tag Master odonto no XML. |
| `FORMAT_FHIR_NOT_FAO` | BLOCKER | Bundle FHIR no lugar de FAO | O conteúdo parece FHIR R4 (RIA/RNDS). O canal odonto LEDI espera ficha FAO Thrift/XML CDS, não FHIR. | Use o export LEDI FAO (tipo 5), não o artefato FHIR RIA. |
| `GESTANTE_MISSING` | BLOCKER | Campo gestante ausente | Boolean gestante é obrigatório mesmo quando false. | Sempre emitir <gestante>true|false</gestante>. |
| `GESTANTE_SEXO_MASC` | BLOCKER | Gestante com sexo masculino | Inconsistência clínica/regra FAO: gestante=true com sexo masculino. | Corrigir sexo ou desmarcar gestante. |
| `HORA_FIM_ANTES_INI` | BLOCKER | Fim antes do início | Horário final é anterior ao inicial — inconsistência temporal. | Corrigir as marcas de tempo no prontuário/export. |
| `HORA_FIM_MISSING` | BLOCKER | Horário final ausente | dataHoraFinalAtendimento é obrigatória. | Exportar fim do atendimento. |
| `HORA_INI_ANTES_DATA` | MONEY_RISK | Início antes da data do header | dataHoraInicialAtendimento anterior a dataAtendimento do header. | Alinhar data do header com o período do atendimento. |
| `HORA_INI_MISSING` | BLOCKER | Horário inicial ausente | dataHoraInicialAtendimento (epoch ms) é obrigatória. | Exportar início do atendimento. |
| `IBGE_FORMAT` | MONEY_RISK | IBGE inválido | O código IBGE não tem 7 dígitos numéricos. | Corrigir o código do município no cadastro da unidade. |
| `IBGE_MISSING` | MONEY_RISK | IBGE do município ausente | codigoIbgeMunicipio no header é necessário para territorializar a produção. | Cadastrar IBGE 7 dígitos (Franca = 3516200). |
| `INE_MISSING` | QUALITY_WARN | INE ausente (LEDI) | Sem INE a equipe APS não fica amarrada na lotação — Siaps pode aceitar, mas APS/Previne fica inconsistente. | Preencher INE da eSB no envelope e na lotação. |
| `JUSTIFICATIVA_CPF_MISSING` | BLOCKER | Justificativa de não-CPF ausente | Com stNaoPossuiCpf=true é obrigatório informar justificativaNaoPossuiCpf. | Preencher o código de justificativa conforme tabela LEDI. |
| `JUSTIFICATIVA_CPF_UNEXPECTED` | MONEY_RISK | Justificativa de CPF inesperada | Há justificativa sem stNaoPossuiCpf=true — inconsistência de regra. | Remover justificativa ou marcar stNaoPossuiCpf corretamente. |
| `LOCAL_ATENDIMENTO` | BLOCKER | localAtendimento inválido | Deve ser código 1–10 da tabela de local de atendimento FAO. | Preencher local válido (ex.: 1 = UBS). |
| `PATIENT_ID_MISSING` | BLOCKER | Sem identificação do cidadão | Sem CPF/CNS e sem stNaoPossuiCpf=true a produção não individualiza a pessoa. | Informar CPF ou CNS, ou marcar stNaoPossuiCpf + justificativa. |
| `PROBLEMAS_MISSING` | BLOCKER | problemasCondicoes ausente | FAO exige ao menos um CIAP e/ou CID10 no atendimento (qualidade clínica + aceite LEDI). | Incluir problemasCondicoes com ciap e/ou cid10. |
| `PROBLEMA_SEM_CODIGO` | BLOCKER | Problema sem CIAP/CID | Existe bloco problemasCondicoes, mas sem código CIAP nem CID10. | Preencher ciap ou cid10 válido. |
| `PROC_CODE_EMPTY` | MONEY_RISK | Procedimento sem código | Há item em procedimentosRealizados sem coMsProcedimento. | Preencher SIGTAP 10 dígitos. |
| `PROC_DUPLICATE` | BLOCKER | Procedimento duplicado | O mesmo coMsProcedimento aparece mais de uma vez no atendimento. | Somar quantidades em um único item ou remover duplicata. |
| `PROC_ESCUTA_FORBIDDEN` | BLOCKER | Procedimento de escuta inicial proibido aqui | 0301040079 não deve ir em procedimentos — registra-se via tipoAtendimento=4. | Remover o proc e usar o tipo de atendimento correto. |
| `PROC_QTD` | MONEY_RISK | Quantidade de procedimento inválida | quantidade deve ser inteiro positivo válido para o SIGTAP. | Corrigir a quantidade (≥ 1). |
| `PROF_CNS_INVALID` | MONEY_RISK | CNS do profissional inválido | O CNS falha no dígito verificador (módulo 11) — tipicamente digitação/cadastro. | Corrigir o CNS no cadastro do profissional e reexportar. |
| `PROF_CNS_MISSING` | BLOCKER | CNS do profissional ausente | A lotação (header) exige CNS do profissional que registrou o atendimento. | Preencher profissionalCNS na lotaçãoFormPrincipal. |
| `SEXO_INVALID` | BLOCKER | Sexo inválido/ausente | sexo deve ser 0 (masculino) ou 1 (feminino) conforme dicionário FAO. | Corrigir o campo sexo no atendimento. |
| `ST_NAO_POSSUI_CPF` | BLOCKER | stNaoPossuiCpf ausente | Campo boolean obrigatório no LEDI recente: declara se o cidadão não possui CPF. Ausente = rejeição (visto em 100% dos lotes Franca). | Inserir false quando há CPF/CNS; true + justificativa quando não há CPF. |
| `TIPO_ATENDIMENTO` | BLOCKER | tipoAtendimento inválido | Valor fora do domínio permitido para FAO (consulta, urgência, etc.). | Usar código de tipoAtendimento aceito na Tabela FAO. |
| `TIPO_CONSULTA_FORBIDDEN` | BLOCKER | tiposConsultaOdonto não permitido | O tipo de atendimento atual não admite tiposConsultaOdonto. | Remover tiposConsultaOdonto ou mudar tipoAtendimento. |
| `TIPO_CONSULTA_MULTI` | MONEY_RISK | Mais de um tiposConsultaOdonto | O dicionário aceita no máximo 1 item nessa lista. | Manter apenas um código de consulta. |
| `TIPO_CONSULTA_REQUIRED` | BLOCKER | tiposConsultaOdonto obrigatório | Para certos tipoAtendimento (ex. consulta agendada) a regra FAO exige tiposConsultaOdonto. | Informar tiposConsultaOdonto 1, 2 ou 4 conforme o caso. |
| `TIPO_CONSULTA_URGENCIA` | BLOCKER | Consulta incompatível com urgência | Combinação indevida entre tipoAtendimento de urgência e tiposConsultaOdonto. | Ajustar conforme regras FAO de urgência × consulta. |
| `TP_CDS_ORIGEM_MISSING` | BLOCKER | tpCdsOrigem ausente | Indica a origem do CDS (sistema gerador). Obrigatório no master FAO. | Exportar tpCdsOrigem (legado SIGS costuma usar 3). |
| `TP_CDS_ORIGEM_NOT_3` | MONEY_RISK | tpCdsOrigem diferente de 3 | Sistemas terceiros tipicamente usam origem 3; outro valor pode ser rejeitado conforme regra local. | Alinhar ao valor aceito no ambiente (geralmente 3). |
| `TRATAMENTO_CONCLUIDO_RULE` | BLOCKER | Conduta 15 sem consulta 1/2 | Tratamento concluído (tiposEncamOdonto=15) exige tiposConsultaOdonto 1 ou 2. | Informar consulta 1 ou 2 junto da conduta 15. |
| `TURNO` | BLOCKER | Turno inválido/ausente | turno deve ser 1 (manhã), 2 (tarde) ou 3 (noite). Valor 0 do legado é inválido. | Mapear turno corretamente no export. |
| `UUID_FICHA_LENGTH` | MONEY_RISK | uuidFicha com tamanho inválido | O LEDI FAO espera uuid entre 36 e 44 caracteres; fora disso há risco de rejeição. | Ajustar o gerador para o formato padrão do e-SUS. |
| `UUID_FICHA_MISSING` | BLOCKER | uuidFicha ausente | Toda ficha LEDI precisa de identificador único (36–44 chars) para idempotência no Siaps. | Gerar UUID no export (uuidFicha / uuidDadoSerializado). |
| `VIGILANCIA_MAX` | MONEY_RISK | Vigilância com itens demais | Excede o máximo de 7 códigos de vigilância. | Limitar a lista a no máximo 7. |
| `VIGILANCIA_MISSING` | BLOCKER | Vigilância saúde bucal ausente | tiposVigilanciaSaudeBucal é obrigatório na FAO (FAO#10). | Registrar ao menos um código de vigilância. |
| `XML_PARSE_ERROR` | BLOCKER | XML inválido | O arquivo não é XML bem formado (tag quebrada, encoding, etc.). O parser não consegue ler a árvore. | Reabra o arquivo no gerador/legado e exporte de novo; confira se não foi truncado no zip. |

## Previne ESB (qualidade / indicadores)

| Código | Sev | O que é | Por quê | Como corrigir |
|---|---|---|---|---|
| `PREVINE_B1_NO_FIRST_CONSULTA` | MONEY_RISK | Sem 1ª consulta programada (B1) | B1 conta pessoas com procedimento 03.01.01.015-3. Sem esse SIGTAP o numerador não sobe. | Se for 1ª consulta programada, incluir 0301010153. |
| `PREVINE_B2_NO_CONCLUSAO` | MONEY_RISK | Sem tratamento concluído (B2) | Há 1ª consulta, mas sem conduta 15 — B2 (resolutividade) não conta o par. | Ao concluir o plano, registrar tiposEncamOdonto=15 com consulta 1 ou 2. |
| `PREVINE_B2_NO_PAIR` | INFO | Sem par B1+B2 | B2 é razão concluídos/1ªs consultas. Este XML não tem nenhum dos dois eventos. | Informativo — só agir se o atendimento deveria ser 1ª consulta ou conclusão. |
| `PREVINE_B3_HIGH_EXODONTIA` | MONEY_RISK | Alta proporção de exodontia (B3) | Neste recorte a razão exodontia/procedimentos ≥ 14% (faixa Regular do B3). | Revisar se preventivos/curativos estão sendo registrados. |
| `PREVINE_B3_LOW_EXODONTIA_SHARE` | QUALITY_WARN | Baixa proporção de exodontia (B3) | Proporção local abaixo da faixa ótima B3 (≥3% e <10%) neste atendimento. | Informativo — ajuste só se o mix clínico do período exigir. |
| `PREVINE_B3_NO_EXODONTIA` | INFO | Sem exodontia (recorte local) | B3 é taxa de exodontia no período. Este atendimento não tem exodontia — ok se o perfil for preventivo. | Informativo no XML; olhe o mix do período. |
| `PREVINE_B4_NOT_IN_FAO` | INFO | B4 fora da FAO | Escovação supervisionada (B4) usa ação coletiva 01.01.02.003-1 — não entra na FAO individual. | Registrar em atividade coletiva / ficha correspondente. |
| `PREVINE_B5_HIGH_PREVENTIVE` | QUALITY_WARN | Preventivos muito altos (B5) | Acima de 85% também é Regular no B5 (as duas pontas). | Equilíbrio clínico no mix do período. |
| `PREVINE_B5_LOW_PREVENTIVE` | MONEY_RISK | Poucos preventivos (B5) | Proporção de preventivos < 40% neste atendimento (abaixo do suficiente B5). | Aumentar registro de preventivos vs só curativos/exodontia. |
| `PREVINE_B5_NO_PREVENTIVE` | MONEY_RISK | Sem preventivo (B5) | B5 mede participação de preventivos individuais. Zero preventivo neste XML puxa o indicador para baixo. | Registrar flúor, selante, profilaxia, orientação, etc. |
| `PREVINE_B5_NO_PROCS` | QUALITY_WARN | Sem procs para estimar B5 | Não há procedimentos individuais reconhecidos no XML. | Conferir coMsProcedimento SIGTAP. |
| `PREVINE_B6_NO_ART` | MONEY_RISK | Sem ART (B6) | Há restauração, mas nenhum ART 03.07.01.007-4 — numerador B6 fica zerado neste atendimento. | Quando aplicável, registrar TRA/ART 0307010074. |
| `PREVINE_B6_NO_RESTORATIVE` | INFO | B6 não se aplica | Sem procedimentos restauradores neste XML, B6 não entra no cálculo deste atendimento. | Informativo. |
| `PREVINE_CBO_NOT_ESB` | MONEY_RISK | CBO fora da família ESB | Indicadores bucais filtram CBO 2232*/3224*. CBO fora da família não pontua ESB. | Usar CBO de dentista/TSB elegível. |
| `PREVINE_INE_MISSING` | MONEY_RISK | INE ausente (Previne) | Sem INE os denominadores B1/B4 e o vínculo de equipe no Previne ficam inconsistentes — mesmo se o Siaps aceitar. | Preencher INE da eSB antes do envio final. |
| `PREVINE_PROBLEMAS_MISSING` | MONEY_RISK | Sem CIAP/CID (qualidade Previne) | Além do blocker LEDI, a ausência de problema/condição reduz qualidade da informação para indicadores. | Registrar CIAP/CID clínico real. |
| `PREVINE_VIGILANCIA_99` | QUALITY_WARN | Vigilância só código 99 | Código 99 = “outro” mascara vigilância específica (cárie, periodontal…) e empobrece análise. | Trocar por códigos específicos quando houver condição observada. |

/** Catálogo de alertas → auto-correção ou edição individual. */

import { ERROR_CATALOG, explainError } from './error-catalog';
import {
  coverageSummary,
  effectiveRepairMode,
  getLediError,
} from '@/lib/ledi/error-registry';

export type RepairMode = 'auto' | 'semi' | 'individual' | 'reexport' | 'info';

export type AlertRepair = {
  title: string;
  where: string;
  how: string;
  why?: string;
  channel: 'LEDI' | 'PREVINE';
  /** auto = botão aplica no XML; semi = precisa input; individual = editar; reexport = origem; info = orientação */
  mode: RepairMode;
  ui?:
    | 'ine'
    | 'ciap'
    | 'cbo'
    | 'proc_b1'
    | 'proc_prev'
    | 'proc_art'
    | 'encam_15'
    | 'vigilancia'
    | 'st_cpf'
    | 'turno'
    | 'gestante'
    | 'local'
    | 'consulta'
    | 'cnes'
    | 'ibge'
    | 'justificativa'
    | 'manual';
  button?: string;
  batchable?: boolean;
  /** Campo do formulário individual a destacar */
  focusField?: string;
  /** Passos orientados até a ficha ficar pronta para envio */
  steps?: string[];
  /** O que “100% pronta” significa para este alerta */
  readyGoal?: string;
};

const AUTO = (partial: Omit<AlertRepair, 'mode'>): AlertRepair => ({
  ...partial,
  mode: 'auto',
  batchable: partial.batchable !== false,
});

const INDIVIDUAL = (partial: Omit<AlertRepair, 'mode' | 'batchable'>): AlertRepair => ({
  ...partial,
  mode: 'individual',
  ui: partial.ui || 'manual',
});

const REEXPORT = (partial: Omit<AlertRepair, 'mode' | 'batchable'>): AlertRepair => ({
  ...partial,
  mode: 'reexport',
  ui: partial.ui || 'manual',
  focusField: partial.focusField || 'xml',
});

const INFO = (partial: Omit<AlertRepair, 'mode' | 'batchable' | 'button'>): AlertRepair => ({
  ...partial,
  mode: 'info',
  ui: 'manual',
});

/** Ações com botão de auto-correção (ficha ou lote selecionado). */
export const AUTO_REPAIRS: Record<string, AlertRepair> = {
  ST_NAO_POSSUI_CPF: AUTO({
    title: 'Falta dizer se o cidadão tem CPF',
    where: 'Auto',
    how: 'Marca que há identificação (CNS/CPF) quando o campo estiver ausente.',
    channel: 'LEDI',
    ui: 'st_cpf',
    button: 'Corrigir automaticamente',
  }),
  JUSTIFICATIVA_CPF_MISSING: AUTO({
    title: 'Falta justificativa de não ter CPF',
    where: 'Auto',
    how: 'Escolha o motivo oficial na lista e aplique na ficha (ou em lote).',
    channel: 'LEDI',
    ui: 'justificativa',
    button: 'Preencher justificativa',
    focusField: 'justificativa',
  }),
  INE_MISSING: AUTO({
    title: 'Falta o código da equipe',
    where: 'Auto',
    how: 'Preenche o código da equipe (INE) informado no formulário.',
    channel: 'LEDI',
    ui: 'ine',
    button: 'Preencher código da equipe',
  }),
  PREVINE_INE_MISSING: AUTO({
    title: 'Falta o código da equipe (Previne)',
    where: 'Auto',
    how: 'Preenche o código da equipe de saúde bucal.',
    channel: 'PREVINE',
    ui: 'ine',
    button: 'Preencher código da equipe',
  }),
  PROBLEMAS_MISSING: AUTO({
    title: 'Falta problema/diagnóstico',
    where: 'Auto',
    how: 'Inclui CIAP/CID do formulário.',
    channel: 'LEDI',
    ui: 'ciap',
    button: 'Incluir diagnóstico',
  }),
  PROBLEMA_SEM_CODIGO: AUTO({
    title: 'Problema sem código de diagnóstico',
    where: 'Auto',
    how: 'Preenche CIAP/CID.',
    channel: 'LEDI',
    ui: 'ciap',
    button: 'Incluir diagnóstico',
  }),
  PREVINE_PROBLEMAS_MISSING: AUTO({
    title: 'Falta problema/diagnóstico (Previne)',
    where: 'Auto',
    how: 'Inclui CIAP/CID.',
    channel: 'PREVINE',
    ui: 'ciap',
    button: 'Incluir diagnóstico',
  }),
  VIGILANCIA_MISSING: AUTO({
    title: 'Falta vigilância em saúde bucal',
    where: 'Auto',
    how: 'Registra códigos de vigilância do formulário (padrão 1,3).',
    channel: 'LEDI',
    ui: 'vigilancia',
    button: 'Preencher vigilância',
  }),
  PREVINE_VIGILANCIA_99: AUTO({
    title: 'Vigilância só como “outros”',
    where: 'Auto',
    how: 'Troca o código genérico por códigos específicos.',
    channel: 'PREVINE',
    ui: 'vigilancia',
    button: 'Trocar vigilância',
  }),
  TIPO_CONSULTA_REQUIRED: AUTO({
    title: 'Falta o tipo de consulta',
    where: 'Auto',
    how: 'Define o tipo de consulta (padrão: 1ª consulta).',
    channel: 'LEDI',
    ui: 'consulta',
    button: 'Definir tipo de consulta',
  }),
  TRATAMENTO_CONCLUIDO_RULE: AUTO({
    title: 'Conclusão sem tipo de consulta adequado',
    where: 'Auto',
    how: 'Garante tipo de consulta 1 ou 2 junto com a conclusão do tratamento.',
    channel: 'LEDI',
    ui: 'encam_15',
    button: 'Ajustar consulta + conclusão',
  }),
  GESTANTE_MISSING: AUTO({
    title: 'Falta informar se é gestante',
    where: 'Auto',
    how: 'Marca “não gestante” (ajuste se for gestante).',
    channel: 'LEDI',
    ui: 'gestante',
    button: 'Definir como não gestante',
  }),
  TURNO: AUTO({
    title: 'Turno inválido ou ausente',
    where: 'Auto',
    how: 'Define turno manhã/tarde/noite (padrão: tarde).',
    channel: 'LEDI',
    ui: 'turno',
    button: 'Definir turno',
  }),
  LOCAL_ATENDIMENTO: AUTO({
    title: 'Local de atendimento inválido',
    where: 'Auto',
    how: 'Define o local (padrão: UBS).',
    channel: 'LEDI',
    ui: 'local',
    button: 'Definir local (UBS)',
  }),
  CBO_MISSING: AUTO({
    title: 'Falta a ocupação do profissional',
    where: 'Auto',
    how: 'Aplica ocupação de cirurgião-dentista.',
    channel: 'LEDI',
    ui: 'cbo',
    button: 'Aplicar ocupação (dentista)',
  }),
  CBO_NOT_ODONTO: AUTO({
    title: 'Ocupação não permite ficha odonto',
    where: 'Auto',
    how: 'Troca para ocupação elegível de dentista.',
    channel: 'LEDI',
    ui: 'cbo',
    button: 'Aplicar ocupação (dentista)',
  }),
  PREVINE_CBO_NOT_ESB: AUTO({
    title: 'Ocupação fora da equipe de saúde bucal',
    where: 'Auto',
    how: 'Aplica ocupação de cirurgião-dentista.',
    channel: 'PREVINE',
    ui: 'cbo',
    button: 'Aplicar ocupação (dentista)',
  }),
  CNES_MISSING: AUTO({
    title: 'Falta o CNES da unidade',
    where: 'Auto',
    how: 'Preenche o CNES (7 dígitos) do formulário.',
    channel: 'LEDI',
    ui: 'cnes',
    button: 'Preencher CNES',
  }),
  CNES_FORMAT: AUTO({
    title: 'CNES com formato inválido',
    where: 'Auto',
    how: 'Substitui pelo CNES (7 dígitos) informado.',
    channel: 'LEDI',
    ui: 'cnes',
    button: 'Corrigir CNES',
  }),
  IBGE_MISSING: AUTO({
    title: 'Falta o município (código IBGE)',
    where: 'Auto',
    how: 'Preenche o município (Franca por padrão).',
    channel: 'LEDI',
    ui: 'ibge',
    button: 'Preencher município',
  }),
  IBGE_FORMAT: AUTO({
    title: 'Código do município inválido',
    where: 'Auto',
    how: 'Substitui pelo município informado.',
    channel: 'LEDI',
    ui: 'ibge',
    button: 'Corrigir município',
  }),
  PREVINE_B1_NO_FIRST_CONSULTA: AUTO({
    title: 'Sem 1ª consulta programática (B1)',
    where: 'Auto',
    how: 'Acrescenta o procedimento de 1ª consulta, se for o caso clínico.',
    channel: 'PREVINE',
    ui: 'proc_b1',
    button: 'Acrescentar 1ª consulta',
  }),
  PREVINE_B2_NO_CONCLUSAO: AUTO({
    title: 'Sem conclusão de tratamento (B2)',
    where: 'Auto',
    how: 'Marca conclusão do tratamento + tipo de consulta.',
    channel: 'PREVINE',
    ui: 'encam_15',
    button: 'Marcar conclusão',
  }),
  PREVINE_B5_NO_PREVENTIVE: AUTO({
    title: 'Sem procedimento preventivo (B5)',
    where: 'Auto',
    how: 'Acrescenta um preventivo típico, se for o caso clínico.',
    channel: 'PREVINE',
    ui: 'proc_prev',
    button: 'Acrescentar preventivo',
  }),
  PREVINE_B5_LOW_PREVENTIVE: AUTO({
    title: 'Poucos preventivos (B5)',
    where: 'Auto',
    how: 'Acrescenta um preventivo, se for o caso clínico.',
    channel: 'PREVINE',
    ui: 'proc_prev',
    button: 'Acrescentar preventivo',
  }),
  PREVINE_B6_NO_ART: AUTO({
    title: 'Sem ART (B6)',
    where: 'Auto',
    how: 'Acrescenta ART quando aplicável ao caso clínico.',
    channel: 'PREVINE',
    ui: 'proc_art',
    button: 'Acrescentar ART',
  }),
};


/** Só origem / outro lote — não há patch seguro nesta tela. */
export const REEXPORT_REPAIRS: Record<string, AlertRepair> = {
  WRONG_FICHA_TIPO: REEXPORT({
    title: 'Tipo de ficha errado',
    where: 'Outro lote',
    how: 'Não corrige aqui — use lote FAI/Procedimentos/FAO conforme o tipo.',
    channel: 'LEDI',
  }),
  XML_PARSE_ERROR: REEXPORT({
    title: 'XML inválido',
    where: 'Reexportar',
    how: 'Gerar o XML novamente no sistema de origem.',
    channel: 'LEDI',
  }),
  FORMAT_FHIR_NOT_FAO: REEXPORT({
    title: 'FHIR no lugar de FAO',
    where: 'Reexportar',
    how: 'Exportar LEDI FAO tipo 5.',
    channel: 'LEDI',
  }),
  FORMAT_DADO_TRANSPORT: REEXPORT({
    title: 'Envelope sem FAO',
    where: 'Reexportar',
    how: 'Garantir master odonto no envelope.',
    channel: 'LEDI',
  }),
  FAO_ROOT_NOT_FOUND: REEXPORT({
    title: 'Raiz sem FAO',
    where: 'Reexportar',
    how: 'Enviar XML FAO completo.',
    channel: 'LEDI',
  }),
  FAI_ROOT_NOT_FOUND: REEXPORT({
    title: 'Ficha individual incompleta',
    where: 'Reexportar /aps/lote',
    how: 'Reexporte o XML completo da FAI.',
    channel: 'LEDI',
  }),
  FAI_ATENDIMENTO_MISSING: REEXPORT({
    title: 'FAI sem atendimento',
    where: 'Reexportar',
    how: 'Reexporte com ao menos um atendimento.',
    channel: 'LEDI',
  }),
  PROC_ROOT_NOT_FOUND: REEXPORT({
    title: 'Ficha de procedimentos incompleta',
    where: 'Reexportar /procedimentos/lote',
    how: 'Reexporte o XML completo de procedimentos.',
    channel: 'LEDI',
  }),
  PROC_ATENDIMENTO_MISSING: REEXPORT({
    title: 'Procedimentos sem atendimento',
    where: 'Reexportar',
    how: 'Reexporte com procedimentos lançados.',
    channel: 'LEDI',
  }),
  ATENDIMENTOS_EMPTY: REEXPORT({
    title: 'Sem atendimentos odonto na ficha',
    where: 'Reexportar',
    how: 'A ficha precisa de 1–99 atendimentos. Reexporte na origem.',
    channel: 'LEDI',
  }),
  ATENDIMENTOS_MAX: REEXPORT({
    title: 'Mais de 99 atendimentos na ficha',
    where: 'Reexportar / dividir',
    how: 'Divida a produção em fichas menores na origem.',
    channel: 'LEDI',
  }),
  UUID_FICHA_MISSING: REEXPORT({
    title: 'uuidFicha ausente',
    where: 'Reexportar',
    how: 'Gerar UUID único para esta ficha na origem.',
    channel: 'LEDI',
  }),
};

/** Exigem valor único por ficha / julgamento clínico — edição individual. */
export const INDIVIDUAL_REPAIRS: Record<string, AlertRepair> = {
  CPF_INVALID: INDIVIDUAL({
    title: 'CPF inválido',
    where: 'Editar ficha',
    how: 'Informe um CPF válido (11 dígitos) no campo da ficha.',
    channel: 'LEDI',
    focusField: 'cpf',
  }),
  CNS_INVALID: INDIVIDUAL({
    title: 'CNS cidadão inválido',
    where: 'Editar ficha',
    how: 'Informe um CNS válido (15 dígitos) no campo da ficha.',
    channel: 'LEDI',
    focusField: 'cns',
  }),
  PROF_CNS_INVALID: INDIVIDUAL({
    title: 'CNS profissional inválido',
    where: 'Editar ficha',
    how: 'Informe o CNS do profissional na lotação.',
    channel: 'LEDI',
    focusField: 'profCns',
  }),
  PROF_CNS_MISSING: INDIVIDUAL({
    title: 'CNS profissional ausente',
    where: 'Editar ficha',
    how: 'Informe o CNS do profissional na lotação.',
    channel: 'LEDI',
    focusField: 'profCns',
  }),
  PATIENT_ID_MISSING: INDIVIDUAL({
    title: 'Sem ID do cidadão',
    where: 'Editar ficha',
    how: 'Informe CPF ou CNS, ou marque não possui CPF + justificativa.',
    channel: 'LEDI',
    ui: 'st_cpf',
    focusField: 'cpf',
  }),
  CPF_CNS_BOTH: INDIVIDUAL({
    title: 'CPF e CNS juntos',
    where: 'Editar ficha',
    how: 'Escolha qual identificador manter (CPF ou CNS).',
    channel: 'LEDI',
    focusField: 'keepId',
  }),
  DT_NASCIMENTO_MISSING: INDIVIDUAL({
    title: 'Nascimento ausente',
    where: 'Editar ficha',
    how: 'Informe a data de nascimento.',
    channel: 'LEDI',
    focusField: 'nascimento',
  }),
  SEXO_INVALID: INDIVIDUAL({
    title: 'Sexo inválido',
    where: 'Editar ficha',
    how: 'Selecione masculino (0) ou feminino (1).',
    channel: 'LEDI',
    focusField: 'sexo',
  }),
  GESTANTE_SEXO_MASC: INDIVIDUAL({
    title: 'Gestante × sexo masculino',
    where: 'Editar ficha',
    how: 'Corrigir sexo ou gestante neste atendimento.',
    channel: 'LEDI',
    focusField: 'gestante',
  }),
  DATA_ATENDIMENTO_MISSING: INDIVIDUAL({
    title: 'dataAtendimento ausente',
    where: 'Editar ficha',
    how: 'Informe a data do atendimento.',
    channel: 'LEDI',
    focusField: 'dataAtend',
  }),
  HORA_INI_MISSING: INDIVIDUAL({
    title: 'Horário inicial ausente',
    where: 'Editar ficha',
    how: 'Informe data/hora inicial (ISO ou epoch).',
    channel: 'LEDI',
    focusField: 'horaIni',
  }),
  HORA_FIM_MISSING: INDIVIDUAL({
    title: 'Horário final ausente',
    where: 'Editar ficha',
    how: 'Informe data/hora final (ISO ou epoch).',
    channel: 'LEDI',
    focusField: 'horaFim',
  }),
  HORA_FIM_ANTES_INI: INDIVIDUAL({
    title: 'Fim antes do início',
    where: 'Editar ficha',
    how: 'Ajuste hora inicial e/ou final.',
    channel: 'LEDI',
    focusField: 'horaFim',
  }),
  PROC_DUPLICATE: INDIVIDUAL({
    title: 'Procedimento duplicado',
    where: 'Editar ficha',
    how: 'Remover duplicata ou consolidar quantidade.',
    channel: 'LEDI',
    focusField: 'proc',
  }),
  PROC_ESCUTA_FORBIDDEN: INDIVIDUAL({
    title: 'Proc. escuta proibido',
    where: 'Editar ficha',
    how: 'Remover 0301040079 e usar tipoAtendimento=4.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  PROC_CODE_EMPTY: INDIVIDUAL({
    title: 'Proc. sem código',
    where: 'Editar ficha',
    how: 'Preencher coMsProcedimento SIGTAP.',
    channel: 'LEDI',
    focusField: 'proc',
  }),
  CONDUTAS_MISSING: INDIVIDUAL({
    title: 'Condutas ausentes',
    where: 'Editar ficha',
    how: 'Selecione ao menos uma conduta odontológica.',
    channel: 'LEDI',
    focusField: 'condutas',
  }),
  TIPO_ATENDIMENTO: INDIVIDUAL({
    title: 'tipoAtendimento inválido',
    where: 'Editar ficha',
    how: 'Ajustar código de tipoAtendimento desta ficha.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  TIPO_CONSULTA_FORBIDDEN: INDIVIDUAL({
    title: 'Consulta não permitida',
    where: 'Editar ficha',
    how: 'Remover tiposConsultaOdonto ou mudar tipoAtendimento.',
    channel: 'LEDI',
    focusField: 'consulta',
  }),
  HORA_INI_ANTES_DATA: INDIVIDUAL({
    title: 'Hora inicial antes da data do atendimento',
    where: 'Editar ficha',
    how: 'Ajuste data do atendimento ou hora inicial.',
    channel: 'LEDI',
    focusField: 'dataAtend',
  }),
  PROC_CODE_ABPG: INDIVIDUAL({
    title: 'Código ABPG não é SIGTAP',
    where: 'Editar ficha',
    how: 'Troque ABPG pelo código SIGTAP de 10 dígitos.',
    channel: 'LEDI',
    focusField: 'proc',
  }),
  PROC_CODE_FORMAT: INDIVIDUAL({
    title: 'Código de procedimento inválido',
    where: 'Editar ficha',
    how: 'Use SIGTAP com 10 dígitos.',
    channel: 'LEDI',
    focusField: 'proc',
  }),
  PROC_QTD: INDIVIDUAL({
    title: 'Quantidade de procedimento inválida',
    where: 'Editar ficha',
    how: 'Ajuste quantidade ≥ 1 (automação em P2).',
    channel: 'LEDI',
    focusField: 'proc',
  }),
  CONDUTAS_MAX: INDIVIDUAL({
    title: 'Condutas acima do limite',
    where: 'Editar ficha',
    how: 'Reduza tiposEncamOdonto para no máximo 17 (truncar em lote: P2).',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  VIGILANCIA_MAX: INDIVIDUAL({
    title: 'Vigilância acima do limite',
    where: 'Editar ficha',
    how: 'Reduza tiposVigilanciaSaudeBucal para no máximo 7 (P2).',
    channel: 'LEDI',
    focusField: 'vigilancia',
  }),
  TIPO_CONSULTA_URGENCIA: INDIVIDUAL({
    title: 'Tipo de consulta incompatível com urgência',
    where: 'Editar ficha',
    how: 'Ajuste tipoAtendimento ou tiposConsultaOdonto.',
    channel: 'LEDI',
    focusField: 'consulta',
  }),
  TIPO_CONSULTA_MULTI: INDIVIDUAL({
    title: 'Mais de um tipo de consulta',
    where: 'Editar ficha',
    how: 'Mantenha apenas 1 tiposConsultaOdonto (auto em P2).',
    channel: 'LEDI',
    focusField: 'consulta',
  }),
  ALTA_EPISODIO_RULE: INDIVIDUAL({
    title: 'Alta do episódio sem regra de consulta',
    where: 'Editar ficha',
    how: 'Ajuste conduta e tipo de consulta.',
    channel: 'LEDI',
    focusField: 'consulta',
  }),
  JUSTIFICATIVA_CPF_UNEXPECTED: INDIVIDUAL({
    title: 'Justificativa sem “não possui CPF”',
    where: 'Editar ficha',
    how: 'Remova a justificativa ou marque stNaoPossuiCpf=true (semi em P2).',
    channel: 'LEDI',
    focusField: 'justificativa',
  }),
  UUID_FICHA_LENGTH: INDIVIDUAL({
    title: 'uuidFicha com tamanho inválido',
    where: 'Editar ficha / reexportar',
    how: 'Ajuste para 36–44 chars ou reexporte (semi em P2).',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  TP_CDS_ORIGEM_MISSING: INDIVIDUAL({
    title: 'tpCdsOrigem ausente',
    where: 'Editar ficha',
    how: 'Preencha tpCdsOrigem=3 (auto em P2).',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  TP_CDS_ORIGEM_NOT_3: INDIVIDUAL({
    title: 'tpCdsOrigem diferente de 3',
    where: 'Editar ficha',
    how: 'Ajuste para 3 — origem PEC/sistema (auto em P2).',
    channel: 'LEDI',
    focusField: 'xml',
  }),

};

export const INFO_REPAIRS: Record<string, AlertRepair> = {
  PREVINE_B2_NO_PAIR: INFO({
    title: 'Sem par B1+B2',
    where: 'Informativo',
    how: 'Só agir se o atendimento deveria ser 1ª consulta ou conclusão.',
    channel: 'PREVINE',
  }),
  PREVINE_B3_NO_EXODONTIA: INFO({
    title: 'Sem exodontia',
    where: 'Informativo',
    how: 'Ok se o perfil for preventivo.',
    channel: 'PREVINE',
  }),
  PREVINE_B3_HIGH_EXODONTIA: INFO({
    title: 'Alta exodontia (B3)',
    where: 'Produção do período',
    how: 'Revisar mix clínico — sem botão automático seguro.',
    channel: 'PREVINE',
  }),
  PREVINE_B3_LOW_EXODONTIA_SHARE: INFO({
    title: 'Baixa exodontia (B3)',
    where: 'Informativo',
    how: 'Ajuste só se o mix do período exigir.',
    channel: 'PREVINE',
  }),
  PREVINE_B5_HIGH_PREVENTIVE: INFO({
    title: 'Preventivos muito altos',
    where: 'Informativo',
    how: 'Equilíbrio clínico no período.',
    channel: 'PREVINE',
  }),
  PREVINE_B5_NO_PROCS: INFO({
    title: 'Sem procs para B5',
    where: 'Origem',
    how: 'Conferir SIGTAP no XML.',
    channel: 'PREVINE',
  }),
  PREVINE_B6_NO_RESTORATIVE: INFO({
    title: 'B6 não se aplica',
    where: 'Informativo',
    how: 'Sem restauração neste atendimento.',
    channel: 'PREVINE',
  }),
  PREVINE_B4_NOT_IN_FAO: INFO({
    title: 'B4 fora da FAO',
    where: 'Atividade coletiva',
    how: 'Registrar escovação em ficha coletiva.',
    channel: 'PREVINE',
  }),
};

// Compat aliases used by older UI imports
export const PREVINE_REPAIR = { ...AUTO_REPAIRS, ...INFO_REPAIRS };
export const LEDI_REPAIR = { ...AUTO_REPAIRS, ...INDIVIDUAL_REPAIRS, ...REEXPORT_REPAIRS };

export function lookupRepair(code: string): AlertRepair | undefined {
  const base =
    AUTO_REPAIRS[code] ||
    INDIVIDUAL_REPAIRS[code] ||
    REEXPORT_REPAIRS[code] ||
    INFO_REPAIRS[code];
  const reg = getLediError(code);
  const explain = explainError(code);
  if (!base && !reg && !explain) return undefined;

  const eff = (effectiveRepairMode(code) || base?.mode || 'individual') as RepairMode;
  const mode: RepairMode =
    eff === 'semi' ? 'auto' : eff === 'reexport' ? 'reexport' : (eff as RepairMode);

  const title = explain?.title || base?.title || reg?.title || code;
  const how = explain?.how || base?.how || reg?.how || '';
  const why = explain?.why || base?.why || reg?.why;
  const channel =
    (explain?.channel === 'PREVINE' || reg?.channel === 'PREVINE' || base?.channel === 'PREVINE'
      ? 'PREVINE'
      : 'LEDI') as AlertRepair['channel'];

  return {
    title,
    where: base?.where || reg?.field || (mode === 'reexport' ? 'Reexportar' : 'Editar ficha'),
    how,
    why,
    channel,
    mode,
    ui: (base?.ui || (reg?.ui as AlertRepair['ui']) || 'manual') as AlertRepair['ui'],
    button: base?.button,
    batchable: mode === 'auto' ? base?.batchable !== false : false,
    focusField: base?.focusField || reg?.focusField || (mode === 'reexport' ? 'xml' : undefined),
    readyGoal:
      base?.readyGoal ||
      (mode === 'auto'
        ? 'Zerar este alerta nas fichas afetadas e seguir para o próximo bloqueio vermelho.'
        : mode === 'reexport'
          ? 'Excluir do lote ou reexportar na origem até o alerta sumir.'
          : mode === 'individual'
            ? 'Corrigir cada ficha (ou reexportar) até o alerta sumir e a ficha ficar apta ao envio.'
            : 'Entender o impacto; só alterar a produção se o caso clínico exigir.'),
    steps: base?.steps?.length ? base.steps : defaultSteps(mode, title),
  };
}

function defaultSteps(mode: RepairMode, title: string): string[] {
  if (mode === 'auto') {
    return [
      `Leia o motivo: “${title}”.`,
      'Preencha os campos padrão abaixo (INE, CIAP, CNES…), se o botão pedir.',
      'Clique em “Corrigir todas as afetadas” (ou selecione e corrija só algumas).',
      'Confira no painel se o contador deste erro diminuiu.',
      'Trate o próximo alerta vermelho; só depois os laranjas (faturamento).',
    ];
  }
  if (mode === 'individual') {
    return [
      `Leia o motivo: “${title}”.`,
      'Abra uma ficha da lista filtrada (já está filtrada por este erro).',
      'Ajuste o campo indicado no formulário da ficha ou corrija na origem e reexporte o XML.',
      'Salve/revalide a ficha e confira se o alerta sumiu.',
      'Repita nas demais fichas deste filtro até zerar o bloqueio.',
    ];
  }
  if (mode === 'reexport') {
    return [
      `Leia o motivo: “${title}”.`,
      'Este alerta não tem correção segura neste lote.',
      'Exclua a ficha do lote ou reexporte no sistema de origem / tela do tipo certo.',
      'Reenvie o arquivo corrigido e confira se o alerta sumiu.',
    ];
  }
  return [
    `Este item (“${title}”) é orientação de indicador/qualidade.`,
    'Não bloqueia o envio sozinho — trate depois dos vermelhos e laranjas.',
    'Só mude a ficha se o atendimento realmente deveria ter o procedimento/conduta indicado.',
  ];
}

/** Campos do formulário que o guia deve exibir para este ui. */
export function fieldsForRepairUi(ui?: AlertRepair['ui']): Array<{
  key: string;
  label: string;
  placeholder?: string;
}> {
  switch (ui) {
    case 'ine':
      return [{ key: 'ine', label: 'Código da equipe (INE)', placeholder: '0002165929' }];
    case 'ciap':
      return [
        { key: 'ciap', label: 'CIAP (problema)', placeholder: 'D82' },
        { key: 'cid10', label: 'CID-10 (opcional)', placeholder: 'K02.1' },
      ];
    case 'cbo':
      return [{ key: 'cbo', label: 'CBO do profissional', placeholder: '223208' }];
    case 'vigilancia':
      return [{ key: 'vigilancia', label: 'Códigos de vigilância', placeholder: '1,3' }];
    case 'consulta':
    case 'encam_15':
      return [{ key: 'tipoConsulta', label: 'Tipo de consulta (1=1ª, 2=retorno)', placeholder: '1' }];
    case 'turno':
      return [{ key: 'turno', label: 'Turno (1 manhã, 2 tarde, 3 noite)', placeholder: '2' }];
    case 'gestante':
      return [{ key: 'gestante', label: 'Gestante (true/false)', placeholder: 'false' }];
    case 'local':
      return [{ key: 'local', label: 'Local de atendimento (1=UBS)', placeholder: '1' }];
    case 'cnes':
      return [{ key: 'cnes', label: 'CNES (7 dígitos)', placeholder: '2092528' }];
    case 'ibge':
      return [{ key: 'ibge', label: 'Código IBGE do município', placeholder: '3516200' }];
    case 'justificativa':
      return [
        {
          key: 'justificativa',
          label: 'Justificativa de não ter CPF',
          placeholder: '5',
        },
      ];
    case 'st_cpf':
      return [];
    case 'proc_b1':
    case 'proc_prev':
    case 'proc_art':
      return [];
    default:
      return [];
  }
}

export function isAutoRepair(code: string): boolean {
  return lookupRepair(code)?.mode === 'auto';
}

export function bodyForRepairUi(
  ui: NonNullable<AlertRepair['ui']>,
  fields: {
    ine?: string;
    ciap?: string;
    cid10?: string;
    cbo?: string;
    vigilancia?: string;
    tipoConsulta?: string;
    turno?: string;
    gestante?: string;
    local?: string;
    cnes?: string;
    ibge?: string;
    justificativa?: string;
  },
): Record<string, unknown> | null {
  if (ui === 'ine') {
    const ine = fields.ine?.trim();
    return ine ? { ine } : null;
  }
  if (ui === 'ciap') {
    return {
      problemasCondicoes: [
        { ciap: fields.ciap?.trim() || 'D82', cid10: fields.cid10?.trim() || undefined },
      ],
    };
  }
  if (ui === 'cbo') return { cboCodigo_2002: fields.cbo?.trim() || '223208' };
  if (ui === 'proc_b1') return { procedimentosAdd: [{ coMsProcedimento: '0301010153', quantidade: 1 }] };
  if (ui === 'proc_prev') return { procedimentosAdd: [{ coMsProcedimento: '0101020104', quantidade: 1 }] };
  if (ui === 'proc_art') return { procedimentosAdd: [{ coMsProcedimento: '0307010074', quantidade: 1 }] };
  if (ui === 'encam_15') {
    return {
      tiposEncamOdontoAdd: [15],
      tiposConsultaOdonto: [Number(fields.tipoConsulta) || 1],
    };
  }
  if (ui === 'consulta') {
    return { tiposConsultaOdonto: [Number(fields.tipoConsulta) || 1] };
  }
  if (ui === 'vigilancia') {
    const codes = (fields.vigilancia || '1,3')
      .split(/[,;\s]+/)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    return codes.length ? { tiposVigilanciaSaudeBucal: codes } : null;
  }
  if (ui === 'st_cpf') return { stNaoPossuiCpf: true };
  if (ui === 'justificativa') {
    const n = Number(fields.justificativa);
    const allowed = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 99]);
    return allowed.has(n) ? { justificativaNaoPossuiCpf: n } : null;
  }
  if (ui === 'turno') return { turno: Number(fields.turno) || 2 };
  if (ui === 'gestante') return { gestante: fields.gestante === 'true' };
  if (ui === 'local') return { localAtendimento: Number(fields.local) || 1 };
  if (ui === 'cnes') {
    const cnes = fields.cnes?.replace(/\D/g, '') || '';
    return cnes.length === 7 ? { cnes } : null;
  }
  if (ui === 'ibge') {
    const ibge = fields.ibge?.replace(/\D/g, '') || '3516200';
    return ibge.length === 7 ? { codigoIbgeMunicipio: ibge } : null;
  }
  return null;
}

/** Lista códigos auto vs individual para docs/UI. */
export function repairCoverage() {
  const auto = Object.keys(AUTO_REPAIRS).length;
  const individual = Object.keys(INDIVIDUAL_REPAIRS).length;
  const reexport = Object.keys(REEXPORT_REPAIRS).length;
  const info = Object.keys(INFO_REPAIRS).length;
  const catalog = Object.keys(ERROR_CATALOG).length;
  const registry = coverageSummary();
  return { auto, individual, reexport, info, catalog, registry };
}

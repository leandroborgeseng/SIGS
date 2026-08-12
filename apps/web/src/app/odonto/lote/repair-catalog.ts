/** Catálogo de alertas → auto-correção ou edição individual. */

import { ERROR_CATALOG, explainError } from './error-catalog';

export type RepairMode = 'auto' | 'individual' | 'info';

export type AlertRepair = {
  title: string;
  where: string;
  how: string;
  why?: string;
  channel: 'LEDI' | 'PREVINE';
  /** auto = botão aplica no XML; individual = editar campos da ficha; info = só orientação */
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
    | 'manual';
  button?: string;
  batchable?: boolean;
  /** Campo do formulário individual a destacar */
  focusField?: string;
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

/** Exigem valor único por ficha / julgamento clínico — edição individual. */
export const INDIVIDUAL_REPAIRS: Record<string, AlertRepair> = {
  CPF_INVALID: INDIVIDUAL({
    title: 'CPF inválido',
    where: 'Editar ficha',
    how: 'Corrigir CPF no XML da ficha (valor único do cidadão).',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  CNS_INVALID: INDIVIDUAL({
    title: 'CNS cidadão inválido',
    where: 'Editar ficha',
    how: 'Corrigir CNS do cidadão nesta ficha.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  PROF_CNS_INVALID: INDIVIDUAL({
    title: 'CNS profissional inválido',
    where: 'Editar ficha',
    how: 'Corrigir CNS do profissional no header.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  PROF_CNS_MISSING: INDIVIDUAL({
    title: 'CNS profissional ausente',
    where: 'Editar ficha',
    how: 'Informar profissionalCNS na lotação.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  PATIENT_ID_MISSING: INDIVIDUAL({
    title: 'Sem ID do cidadão',
    where: 'Editar ficha',
    how: 'Informar CPF ou CNS, ou stNaoPossuiCpf + justificativa.',
    channel: 'LEDI',
    ui: 'st_cpf',
    focusField: 'xml',
  }),
  CPF_CNS_BOTH: INDIVIDUAL({
    title: 'CPF e CNS juntos',
    where: 'Editar ficha',
    how: 'Remover um dos dois identificadores neste atendimento.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  JUSTIFICATIVA_CPF_MISSING: INDIVIDUAL({
    title: 'Justificativa de não-CPF',
    where: 'Editar ficha',
    how: 'Informar justificativaNaoPossuiCpf nesta ficha.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  DT_NASCIMENTO_MISSING: INDIVIDUAL({
    title: 'Nascimento ausente',
    where: 'Editar ficha',
    how: 'Preencher dtNascimento do cidadão.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  SEXO_INVALID: INDIVIDUAL({
    title: 'Sexo inválido',
    where: 'Editar ficha',
    how: 'Ajustar sexo (0/1) nesta ficha.',
    channel: 'LEDI',
    focusField: 'xml',
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
    how: 'Preencher data no header desta ficha.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  HORA_INI_MISSING: INDIVIDUAL({
    title: 'Horário inicial ausente',
    where: 'Editar ficha',
    how: 'Preencher dataHoraInicialAtendimento.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  HORA_FIM_MISSING: INDIVIDUAL({
    title: 'Horário final ausente',
    where: 'Editar ficha',
    how: 'Preencher dataHoraFinalAtendimento.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  HORA_FIM_ANTES_INI: INDIVIDUAL({
    title: 'Fim antes do início',
    where: 'Editar ficha',
    how: 'Corrigir marcas de tempo neste atendimento.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  UUID_FICHA_MISSING: INDIVIDUAL({
    title: 'uuidFicha ausente',
    where: 'Editar ficha / reexportar',
    how: 'Gerar UUID único para esta ficha.',
    channel: 'LEDI',
    focusField: 'xml',
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
    how: 'Incluir tiposEncamOdonto clínicos desta consulta.',
    channel: 'LEDI',
    focusField: 'xml',
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
  WRONG_FICHA_TIPO: INDIVIDUAL({
    title: 'Tipo de ficha errado',
    where: 'Outro lote',
    how: 'Não corrige aqui — use lote FAI/Procedimentos.',
    channel: 'LEDI',
  }),
  XML_PARSE_ERROR: INDIVIDUAL({
    title: 'XML inválido',
    where: 'Reexportar',
    how: 'Gerar o XML novamente no sistema de origem.',
    channel: 'LEDI',
    focusField: 'xml',
  }),
  FORMAT_FHIR_NOT_FAO: INDIVIDUAL({
    title: 'FHIR no lugar de FAO',
    where: 'Reexportar',
    how: 'Exportar LEDI FAO tipo 5.',
    channel: 'LEDI',
  }),
  FORMAT_DADO_TRANSPORT: INDIVIDUAL({
    title: 'Envelope sem FAO',
    where: 'Reexportar',
    how: 'Garantir master odonto no envelope.',
    channel: 'LEDI',
  }),
  FAO_ROOT_NOT_FOUND: INDIVIDUAL({
    title: 'Raiz sem FAO',
    where: 'Reexportar',
    how: 'Enviar XML FAO completo.',
    channel: 'LEDI',
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
export const LEDI_REPAIR = { ...AUTO_REPAIRS, ...INDIVIDUAL_REPAIRS };

export function lookupRepair(code: string): AlertRepair | undefined {
  const base = AUTO_REPAIRS[code] || INDIVIDUAL_REPAIRS[code] || INFO_REPAIRS[code];
  const explain = explainError(code);
  if (!base && !explain) return undefined;
  if (!base && explain) {
    const knownAuto = code in AUTO_REPAIRS;
    return {
      title: explain.title,
      where: explain.field || explain.channel,
      how: explain.how,
      why: explain.why,
      channel: explain.channel === 'PREVINE' ? 'PREVINE' : 'LEDI',
      mode: knownAuto ? 'auto' : 'individual',
      ui: 'manual',
    };
  }
  return {
    ...base!,
    why: explain?.why || base!.why,
    how: explain?.how || base!.how,
    title: explain?.title || base!.title || code,
  };
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
  const info = Object.keys(INFO_REPAIRS).length;
  const catalog = Object.keys(ERROR_CATALOG).length;
  return { auto, individual, info, catalog };
}

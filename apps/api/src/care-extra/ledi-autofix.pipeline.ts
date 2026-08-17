/**
 * Pipeline de auto-correção LEDI (FAO/FAI/PROC) — compartilhado entre
 * auto-fix persistente e dry-run.
 */

import type { FaoFinding } from './ledi-fao.validator';
import type { PrevineXray } from './ledi-fao-previne-xray';
import {
  applyAutoFixes,
  addProcedimentos,
  addTiposEncamOdonto,
  fixCbo,
  fixCnes,
  fixForceStNaoPossuiCpfTrue,
  fixGestante,
  fixIbge,
  fixIne,
  fixJustificativaNaoPossuiCpf,
  fixLocalAtendimento,
  fixProblemasCondicoes,
  fixRemoveJustificativaNaoPossuiCpf,
  fixTiposConsultaOdonto,
  fixTiposVigilanciaSaudeBucal,
  fixTurno,
  type AutoFixOptions,
} from './ledi-fao-xml.fixer';
import { applyFaiAutoFixes, FAI_SAFE_DEFAULTS, fixCondutasFai, fixTipoAtendimentoFai } from './ledi-fai-xml.fixer';

export type AutoFixPipelineInput = {
  stNaoPossuiCpf?: boolean;
  stNaoPossuiCpfWhenAbsent?: boolean;
  ine?: string;
  forceSelected?: boolean;
  onlyItemIds?: string[];
  /** Escopo por código de alerta (lote inteiro filtrado no serviço). */
  onlyCode?: string;
  problemasCondicoes?: Array<{ ciap?: string; cid10?: string }>;
  problemasCondicoesDefault?: Array<{ ciap?: string; cid10?: string }>;
  tiposConsultaOdonto?: number[];
  tiposEncamOdontoAdd?: number[];
  tiposVigilanciaSaudeBucal?: number[];
  procedimentosAdd?: Array<{ coMsProcedimento: string; quantidade?: number }>;
  cboCodigo_2002?: string;
  turno?: number;
  gestante?: boolean;
  localAtendimento?: number;
  cnes?: string;
  codigoIbgeMunicipio?: string;
  justificativaNaoPossuiCpf?: number;
  justificativaCpfUnexpected?: 'remove' | 'force_st';
  regenerateUuidFicha?: boolean;
  /** Canal do lote — FAI/CDS não aplica CIAP/CBO/vigilância odonto. */
  fichaTipo?:
    | 'FAO'
    | 'FAI'
    | 'PROCEDIMENTOS'
    | 'CADASTRO_INDIVIDUAL'
    | 'CADASTRO_DOMICILIAR'
    | 'COLETIVO'
    | 'VISITA_ACS'
    | 'AD';
  condutas?: number[];
  tipoAtendimento?: number;
};

export type AutoFixPipelineResult = {
  xml: string;
  changed: boolean;
  applied: string[];
};

/** Ordem estável: st/CPF → identidade de equipe → clínica → envelope. */
export function runAutoFixPipeline(
  xml: string,
  findings: FaoFinding[],
  dto: AutoFixPipelineInput,
  previneGaps: string[] = [],
): AutoFixPipelineResult {
  const cdsLike =
    dto.fichaTipo === 'FAI' ||
    dto.fichaTipo === 'PROCEDIMENTOS' ||
    dto.fichaTipo === 'CADASTRO_INDIVIDUAL' ||
    dto.fichaTipo === 'CADASTRO_DOMICILIAR' ||
    dto.fichaTipo === 'COLETIVO' ||
    dto.fichaTipo === 'VISITA_ACS' ||
    dto.fichaTipo === 'AD';
  if (cdsLike) {
    return runFaiAutoFixPipeline(xml, findings, dto);
  }

  const opts: AutoFixOptions = {
    stNaoPossuiCpf: dto.forceSelected
      ? dto.stNaoPossuiCpf === true
      : dto.stNaoPossuiCpf !== false,
    stNaoPossuiCpfWhenAbsent: dto.stNaoPossuiCpfWhenAbsent !== false,
    ine: dto.ine,
    justificativaCpfUnexpected: dto.justificativaCpfUnexpected,
    regenerateUuidFicha: dto.regenerateUuidFicha !== false,
  };

  const applied: string[] = [];
  let current = xml;
  let changed = false;

  const auto = applyAutoFixes(current, findings, opts);
  if (auto.applied.length) {
    current = auto.xml;
    changed = true;
    applied.push(...auto.applied);
  }

  const codes = new Set([...findings.map((f) => f.code), ...previneGaps]);
  const force =
    !!dto.forceSelected && (!!dto.onlyItemIds?.length || !!dto.onlyCode?.trim());

  const step = (label: string, next: { xml: string; changed: boolean }) => {
    if (!next.changed) return;
    current = next.xml;
    changed = true;
    applied.push(label);
  };

  if (dto.ine?.trim() && (force || codes.has('INE_MISSING') || codes.has('PREVINE_INE_MISSING'))) {
    step('INE', fixIne(current, dto.ine));
  }

  const problemas = dto.problemasCondicoes?.length
    ? dto.problemasCondicoes
    : dto.problemasCondicoesDefault;
  if (
    problemas?.length &&
    (force ||
      codes.has('PROBLEMAS_MISSING') ||
      codes.has('PROBLEMA_SEM_CODIGO') ||
      codes.has('PREVINE_PROBLEMAS_MISSING'))
  ) {
    step('PROBLEMAS', fixProblemasCondicoes(current, problemas));
  }

  if (
    dto.tiposConsultaOdonto?.length &&
    (force || codes.has('TIPO_CONSULTA_REQUIRED') || codes.has('TRATAMENTO_CONCLUIDO_RULE'))
  ) {
    step('CONSULTA', fixTiposConsultaOdonto(current, dto.tiposConsultaOdonto));
  }

  if (dto.tiposEncamOdontoAdd?.length && force) {
    step('ENCAM', addTiposEncamOdonto(current, dto.tiposEncamOdontoAdd));
  }

  if (
    dto.tiposVigilanciaSaudeBucal?.length &&
    (force || codes.has('PREVINE_VIGILANCIA_99') || codes.has('VIGILANCIA_MISSING'))
  ) {
    step('VIGILANCIA', fixTiposVigilanciaSaudeBucal(current, dto.tiposVigilanciaSaudeBucal));
  }

  if (dto.procedimentosAdd?.length && force) {
    step('PROCS', addProcedimentos(current, dto.procedimentosAdd));
  }

  if (
    dto.cboCodigo_2002?.trim() &&
    (force || codes.has('PREVINE_CBO_NOT_ESB') || codes.has('CBO_NOT_ODONTO') || codes.has('CBO_MISSING'))
  ) {
    step('CBO', fixCbo(current, dto.cboCodigo_2002));
  }

  if (dto.turno != null && (force || codes.has('TURNO'))) {
    step('TURNO', fixTurno(current, dto.turno));
  }

  if (dto.gestante !== undefined && (force || codes.has('GESTANTE_MISSING'))) {
    step('GESTANTE', fixGestante(current, dto.gestante));
  }

  if (dto.localAtendimento != null && (force || codes.has('LOCAL_ATENDIMENTO'))) {
    step('LOCAL', fixLocalAtendimento(current, dto.localAtendimento));
  }

  if (dto.cnes?.trim() && (force || codes.has('CNES_MISSING') || codes.has('CNES_FORMAT'))) {
    step('CNES', fixCnes(current, dto.cnes));
  }

  if (
    dto.codigoIbgeMunicipio?.trim() &&
    (force || codes.has('IBGE_MISSING') || codes.has('IBGE_FORMAT'))
  ) {
    step('IBGE', fixIbge(current, dto.codigoIbgeMunicipio));
  }

  if (dto.justificativaNaoPossuiCpf != null && (force || codes.has('JUSTIFICATIVA_CPF_MISSING'))) {
    step('JUSTIFICATIVA', fixJustificativaNaoPossuiCpf(current, dto.justificativaNaoPossuiCpf));
  }

  if (dto.justificativaCpfUnexpected && (force || codes.has('JUSTIFICATIVA_CPF_UNEXPECTED'))) {
    step(
      'JUSTIFICATIVA_UNEXPECTED',
      dto.justificativaCpfUnexpected === 'remove'
        ? fixRemoveJustificativaNaoPossuiCpf(current)
        : fixForceStNaoPossuiCpfTrue(current),
    );
  }

  return { xml: current, changed, applied };
}

function runFaiAutoFixPipeline(
  xml: string,
  findings: FaoFinding[],
  dto: AutoFixPipelineInput,
): AutoFixPipelineResult {
  const applied: string[] = [];
  let current = xml;
  let changed = false;

  const auto = applyFaiAutoFixes(current, findings, {
    stNaoPossuiCpf: dto.stNaoPossuiCpf !== false,
    stNaoPossuiCpfWhenAbsent: dto.stNaoPossuiCpfWhenAbsent !== false,
    ine: dto.ine,
    justificativaCpfUnexpected: dto.justificativaCpfUnexpected,
    regenerateUuidFicha: dto.regenerateUuidFicha !== false,
    ibgeDefault: dto.codigoIbgeMunicipio?.trim() || FAI_SAFE_DEFAULTS.ibge,
  });
  if (auto.applied.length) {
    current = auto.xml;
    changed = true;
    applied.push(...auto.applied);
  }

  const codes = new Set(findings.map((f) => f.code));
  const force =
    !!dto.forceSelected && (!!dto.onlyItemIds?.length || !!dto.onlyCode?.trim());
  const step = (label: string, next: { xml: string; changed: boolean }) => {
    if (!next.changed) return;
    current = next.xml;
    changed = true;
    applied.push(label);
  };

  if (dto.ine?.trim() && (force || codes.has('INE_MISSING'))) {
    step('INE', fixIne(current, dto.ine));
  }
  if (dto.turno != null && (force || codes.has('TURNO'))) {
    step('TURNO', fixTurno(current, dto.turno));
  }
  if (dto.localAtendimento != null && (force || codes.has('LOCAL_ATENDIMENTO'))) {
    step('LOCAL', fixLocalAtendimento(current, dto.localAtendimento));
  }
  if (dto.cnes?.trim() && (force || codes.has('CNES_MISSING') || codes.has('CNES_FORMAT'))) {
    step('CNES', fixCnes(current, dto.cnes));
  }
  if (dto.codigoIbgeMunicipio?.trim() && (force || codes.has('IBGE_MISSING') || codes.has('IBGE_FORMAT'))) {
    step('IBGE', fixIbge(current, dto.codigoIbgeMunicipio));
  }
  if (dto.justificativaNaoPossuiCpf != null && (force || codes.has('JUSTIFICATIVA_CPF_MISSING'))) {
    step('JUSTIFICATIVA', fixJustificativaNaoPossuiCpf(current, dto.justificativaNaoPossuiCpf));
  }
  if (dto.justificativaCpfUnexpected && (force || codes.has('JUSTIFICATIVA_CPF_UNEXPECTED'))) {
    step(
      'JUSTIFICATIVA_UNEXPECTED',
      dto.justificativaCpfUnexpected === 'remove'
        ? fixRemoveJustificativaNaoPossuiCpf(current)
        : fixForceStNaoPossuiCpfTrue(current),
    );
  }
  // Conduta / tipo / CIAP só com valor explícito do usuário — nunca default em lote.
  if (dto.condutas?.length && force) {
    step('CONDUTAS_FAI', fixCondutasFai(current, dto.condutas));
  }
  if (dto.tipoAtendimento != null && force) {
    step('TIPO_ATENDIMENTO', fixTipoAtendimentoFai(current, dto.tipoAtendimento));
  }

  return { xml: current, changed, applied };
}

export function previneGapCodes(previneJson: string | null | undefined): string[] {
  if (!previneJson) return [];
  try {
    const x = JSON.parse(previneJson) as PrevineXray;
    return x?.gaps?.map((g) => g.code) || [];
  } catch {
    return [];
  }
}

/** Defaults municipais Franca (política local P4). */
export const FRANCA_LEDI_DEFAULTS = {
  municipioIbge: '3516200',
  municipioNome: 'Franca',
  /** Exemplos comuns — UI deve preferir lotação logada quando disponível. */
  cnesSugestoes: ['9647198', '2035871', '2061589', '2092528'],
  cboOdontoPadrao: '223208',
  cboMedicoPadrao: '225125',
  turnoPadrao: 2,
  localAtendimentoPadrao: 1,
} as const;

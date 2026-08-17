/**
 * Validadores LEDI CDS — tipos 2, 3, 6, 8, 10.
 * Schema a partir de TipoDadoTranspEnum + tags *Transport (sem dump Franca).
 * Críticas alinhadas a FAI/FAO/PROC (header · identidade · cruzamento municipal).
 */

import type { FaoFinding } from './ledi-fao.validator';
import { detectLediFichaTipo, type LediFichaTipoId } from './ledi-ficha-tipo';
import {
  appendMunicipalCrossChecks,
  countBySeverity,
  eachXmlBlocks,
  type LediMunicipalCrossCtx,
  validateCdsHeader,
  validateCitizenIdentityBlock,
} from './ledi-cds-common';

export type CdsExtraValidationReport = {
  conformant: boolean;
  siapsReady: boolean;
  previneReady: boolean;
  readyForFinalSend: boolean;
  channel: string;
  sourceKind: 'xml';
  detectedFormat: string;
  summary: {
    blockers: number;
    moneyRisks: number;
    qualityWarns: number;
    infos: number;
  };
  findings: FaoFinding[];
};

type Spec = {
  id: LediFichaTipoId;
  code: number;
  rootRe: RegExp;
  rootCode: string;
  childTags?: string[];
  childEmptyCode?: string;
  identityOnChildren?: boolean;
  identityOnRootFallback?: boolean;
  requireDataAtendimento?: boolean;
  channel: string;
  format: string;
};

const SPECS: Record<string, Spec> = {
  CADASTRO_INDIVIDUAL: {
    id: 'CADASTRO_INDIVIDUAL',
    code: 2,
    rootRe: /cadastroIndividualTransport/i,
    rootCode: 'CAD_IND_ROOT_NOT_FOUND',
    childTags: ['fichaCadastroIndividualChild', 'cadastroIndividualChild'],
    identityOnChildren: true,
    identityOnRootFallback: true,
    requireDataAtendimento: false,
    channel: 'LEDI_CAD_IND_SIAPS',
    format: 'LEDI_CADASTRO_INDIVIDUAL_XML',
  },
  CADASTRO_DOMICILIAR: {
    id: 'CADASTRO_DOMICILIAR',
    code: 3,
    rootRe: /cadastroDomiciliarTransport/i,
    rootCode: 'CAD_DOM_ROOT_NOT_FOUND',
    requireDataAtendimento: false,
    channel: 'LEDI_CAD_DOM_SIAPS',
    format: 'LEDI_CADASTRO_DOMICILIAR_XML',
  },
  COLETIVO: {
    id: 'COLETIVO',
    code: 6,
    rootRe: /fichaAtividadeColetivaMasterTransport/i,
    rootCode: 'COLETIVO_ROOT_NOT_FOUND',
    requireDataAtendimento: true,
    channel: 'LEDI_COLETIVO_SIAPS',
    format: 'LEDI_COLETIVO_XML',
  },
  VISITA_ACS: {
    id: 'VISITA_ACS',
    code: 8,
    rootRe: /fichaVisitaDomiciliarMasterTransport/i,
    rootCode: 'VISITA_ROOT_NOT_FOUND',
    childTags: ['visitasDomiciliares', 'visitasDomiliciares', 'fichaVisitaDomiciliarChild'],
    childEmptyCode: 'VISITA_CHILD_MISSING',
    identityOnChildren: true,
    identityOnRootFallback: true,
    requireDataAtendimento: true,
    channel: 'LEDI_VISITA_ACS_SIAPS',
    format: 'LEDI_VISITA_ACS_XML',
  },
  AD: {
    id: 'AD',
    code: 10,
    rootRe: /fichaAtendimentoDomiciliarMasterTransport/i,
    rootCode: 'AD_ROOT_NOT_FOUND',
    childTags: ['atendimentosDomiciliares'],
    childEmptyCode: 'AD_ATENDIMENTO_MISSING',
    identityOnChildren: true,
    requireDataAtendimento: true,
    channel: 'LEDI_AD_SIAPS',
    format: 'LEDI_AD_XML',
  },
};

function finish(findings: FaoFinding[], spec: Spec): CdsExtraValidationReport {
  const summary = countBySeverity(findings);
  const siapsReady = summary.blockers === 0;
  return {
    conformant: siapsReady && summary.moneyRisks === 0,
    siapsReady,
    previneReady: true,
    readyForFinalSend: siapsReady && summary.moneyRisks === 0,
    channel: spec.channel,
    sourceKind: 'xml',
    detectedFormat: spec.format,
    summary,
    findings,
  };
}

function firstChildBlocks(xml: string, tags: string[]): { tag: string; blocks: string[] } {
  for (const t of tags) {
    const blocks = eachXmlBlocks(xml, t);
    if (blocks.length) return { tag: t, blocks };
  }
  return { tag: tags[0] || 'child', blocks: [] };
}

function validateBySpec(
  xml: string,
  spec: Spec,
  municipal?: LediMunicipalCrossCtx | null,
): CdsExtraValidationReport {
  const findings: FaoFinding[] = [];
  const tipo = detectLediFichaTipo(xml);

  if (tipo.id !== spec.id) {
    findings.push({
      severity: 'BLOCKER',
      code: 'WRONG_FICHA_TIPO',
      message: `Esperado ${spec.id} (${spec.code}); detectado ${tipo.label} (${tipo.code ?? '?'}).`,
      field: 'tipoDadoSerializado',
      rule: 'LEDI-tipo',
      hint: tipo.correctionPath,
    });
  }

  if (!spec.rootRe.test(xml)) {
    findings.push({
      severity: 'BLOCKER',
      code: spec.rootCode,
      message: `Raiz ${spec.rootRe.source} não encontrada.`,
      field: 'master',
      rule: 'LEDI-CDS',
    });
  }

  const header = validateCdsHeader(findings, xml, {
    requireDataAtendimento: spec.requireDataAtendimento,
  });
  appendMunicipalCrossChecks(findings, header, municipal);

  if (spec.id === 'CADASTRO_DOMICILIAR') {
    if (!/<tipoImovel\b/i.test(xml) && !/<tipoDeImovel\b/i.test(xml)) {
      findings.push({
        severity: 'MONEY_RISK',
        code: 'TIPO_IMOVEL_MISSING',
        message: 'tipoImovel ausente no cadastro domiciliar.',
        field: 'tipoImovel',
        rule: 'LEDI-CDS-3',
      });
    }
  }

  if (spec.id === 'COLETIVO') {
    const n = Number(
      xml.match(/<numParticipantes>\s*([^<]+)/i)?.[1]?.trim() ||
        xml.match(/<numeroParticipantes>\s*([^<]+)/i)?.[1]?.trim() ||
        '',
    );
    if (!Number.isFinite(n) || n < 1) {
      findings.push({
        severity: 'BLOCKER',
        code: 'COLETIVO_PARTICIPANTES',
        message: 'numParticipantes deve ser ≥ 1.',
        field: 'numParticipantes',
        rule: 'LEDI-CDS-6',
      });
    }
    if (!/<tipoAtividade\b/i.test(xml) && !/<atividadeTipo\b/i.test(xml)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'COLETIVO_TIPO_ATIVIDADE',
        message: 'tipoAtividade ausente.',
        field: 'tipoAtividade',
        rule: 'LEDI-CDS-6',
      });
    }
  }

  if (spec.childTags?.length) {
    const { tag, blocks } = firstChildBlocks(xml, spec.childTags);
    if (!blocks.length && spec.childEmptyCode) {
      findings.push({
        severity: 'BLOCKER',
        code: spec.childEmptyCode,
        message: `Nenhum bloco filho (${spec.childTags.join('|')}).`,
        field: tag,
        rule: 'LEDI-CDS',
      });
    }
    if (spec.identityOnChildren && blocks.length) {
      blocks.forEach((b, i) => validateCitizenIdentityBlock(findings, b, `${tag}[${i}]`));
    } else if (spec.identityOnRootFallback && !blocks.length) {
      validateCitizenIdentityBlock(findings, xml, 'cidadao');
    }
  }

  return finish(findings, spec);
}

export function validateCadastroIndividualXml(
  xml: string,
  municipal?: LediMunicipalCrossCtx | null,
) {
  return validateBySpec(xml, SPECS.CADASTRO_INDIVIDUAL!, municipal);
}

export function validateCadastroDomiciliarXml(
  xml: string,
  municipal?: LediMunicipalCrossCtx | null,
) {
  return validateBySpec(xml, SPECS.CADASTRO_DOMICILIAR!, municipal);
}

export function validateColetivoXml(xml: string, municipal?: LediMunicipalCrossCtx | null) {
  return validateBySpec(xml, SPECS.COLETIVO!, municipal);
}

export function validateVisitaAcsXml(xml: string, municipal?: LediMunicipalCrossCtx | null) {
  return validateBySpec(xml, SPECS.VISITA_ACS!, municipal);
}

export function validateAdXml(xml: string, municipal?: LediMunicipalCrossCtx | null) {
  return validateBySpec(xml, SPECS.AD!, municipal);
}

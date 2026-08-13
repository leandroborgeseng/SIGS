/**
 * Validador estrutural LEDI — Ficha de Atendimento Individual (tipo 4).
 * Bloqueios prioritários do lote Franca / Novas Fichas Exemplo.
 */

import { isValidCns, isValidCpf, type FaoFinding, type FaoSeverity } from './ledi-fao.validator';
import { detectLediFichaTipo } from './ledi-ficha-tipo';

export type FaiValidationReport = {
  conformant: boolean;
  siapsReady: boolean;
  previneReady: boolean;
  readyForFinalSend: boolean;
  channel: 'LEDI_FAI_SIAPS';
  sourceKind: 'xml' | 'json';
  detectedFormat: string;
  summary: {
    blockers: number;
    moneyRisks: number;
    qualityWarns: number;
    infos: number;
  };
  findings: FaoFinding[];
};

function count(findings: FaoFinding[], sev: FaoSeverity) {
  return findings.filter((f) => f.severity === sev).length;
}

function eachAtendimento(xml: string): string[] {
  const blocks: string[] = [];
  const re = /<atendimentosIndividuais\b[^>]*>([\s\S]*?)<\/atendimentosIndividuais>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) blocks.push(m[1]);
  return blocks;
}

export function validateFaiXml(xml: string): FaiValidationReport {
  const findings: FaoFinding[] = [];
  const tipo = detectLediFichaTipo(xml);

  if (tipo.id !== 'FAI') {
    findings.push({
      severity: 'BLOCKER',
      code: 'WRONG_FICHA_TIPO',
      message: `Esperado FAI (4); detectado ${tipo.label} (${tipo.code ?? '?'}).`,
      field: 'tipoDadoSerializado',
      rule: 'LEDI-tipo',
      hint: tipo.correctionPath,
    });
  }

  if (!/fichaAtendimentoIndividualMasterTransport/i.test(xml)) {
    findings.push({
      severity: 'BLOCKER',
      code: 'FAI_ROOT_NOT_FOUND',
      message: 'Raiz fichaAtendimentoIndividualMasterTransport não encontrada.',
      field: 'master',
      rule: 'LEDI-FAI',
    });
  }

  const blocks = eachAtendimento(xml);
  if (!blocks.length) {
    findings.push({
      severity: 'BLOCKER',
      code: 'FAI_ATENDIMENTO_MISSING',
      message: 'Nenhum bloco atendimentosIndividuais.',
      field: 'atendimentosIndividuais',
      rule: 'LEDI-FAI',
    });
  }

  for (const body of blocks) {
    if (!/<stNaoPossuiCpf\b/i.test(body)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'ST_NAO_POSSUI_CPF',
        message: 'Campo stNaoPossuiCpf ausente no atendimento individual.',
        field: 'stNaoPossuiCpf',
        rule: 'LEDI-FAI',
        hint: 'Inserir false quando há CNS/CPF.',
      });
    }

    const cpf = body.match(/<cpfCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
    const cns = body.match(/<cnsCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
    if (!cpf && !cns) {
      findings.push({
        severity: 'BLOCKER',
        code: 'PATIENT_ID_MISSING',
        message: 'Sem CPF nem CNS do cidadão.',
        field: 'cnsCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (cns && !isValidCns(cns)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CNS_INVALID',
        message: 'CNS do cidadão inválido.',
        field: 'cnsCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (cpf && !isValidCpf(cpf)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CPF_INVALID',
        message: 'CPF do cidadão inválido.',
        field: 'cpfCidadao',
        rule: 'LEDI-FAI',
      });
    }

    const turno = Number(body.match(/<turno>\s*([^<]+)/i)?.[1]?.trim());
    if (!Number.isFinite(turno) || ![1, 2, 3].includes(turno)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TURNO',
        message: `Turno inválido (${turno || 'ausente'}); use 1, 2 ou 3.`,
        field: 'turno',
        rule: 'LEDI-FAI',
      });
    }

    if (!/<dtNascimento\b/i.test(body) && !/<dataNascimento\b/i.test(body)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'DT_NASCIMENTO_MISSING',
        message: 'dtNascimento/dataNascimento ausente.',
        field: 'dtNascimento',
        rule: 'LEDI-FAI',
      });
    }

    const sexo = body.match(/<sexo>\s*([^<]+)/i)?.[1]?.trim();
    if (sexo == null || sexo === '' || !['0', '1'].includes(sexo)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'SEXO_INVALID',
        message: `Sexo inválido (${sexo ?? 'ausente'}); use 0 ou 1.`,
        field: 'sexo',
        rule: 'LEDI-FAI',
      });
    }

    const localRaw =
      body.match(/<localAtendimento>\s*([^<]+)/i)?.[1]?.trim() ||
      body.match(/<localDeAtendimento>\s*([^<]+)/i)?.[1]?.trim();
    const local = Number(localRaw);
    if (!Number.isFinite(local) || local < 1 || local > 10) {
      findings.push({
        severity: 'BLOCKER',
        code: 'LOCAL_ATENDIMENTO',
        message: `localAtendimento inválido (${local || 'ausente'}).`,
        field: 'localAtendimento',
        rule: 'LEDI-FAI',
      });
    }
  }

  const cnes =
    xml.match(/<cnesDadoSerializado>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    xml.match(/<cnes>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    '';
  if (!cnes) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_MISSING',
      message: 'CNES ausente.',
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  } else if (cnes.length !== 7) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_FORMAT',
      message: `CNES deve ter 7 dígitos (atual: ${cnes.length}).`,
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  }

  const ineLot =
    xml.match(/<lotacaoFormPrincipal[\s\S]*?<ine>\s*([^<]*)/i)?.[1]?.replace(/\D/g, '') ||
    xml.match(/<ineDadoSerializado>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    '';
  if (!ineLot) {
    findings.push({
      severity: 'QUALITY_WARN',
      code: 'INE_MISSING',
      message: 'INE ausente na lotação/envelope.',
      field: 'ine',
      rule: 'LEDI-FAI',
    });
  }

  return buildFaiReport(findings, 'xml', 'LEDI_FAI_XML');
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

const FAI_TIPO_OK = new Set([1, 2, 4, 5, 6]);

/**
 * Valida payload JSON do mapper `ledi-individual-v2` (origem APS / FAI tipo 4).
 * Mesmos blockers estruturais do XML (identificação, turno, CNES, condutas, problema).
 */
export function validateFaiJson(master: Record<string, unknown>): FaiValidationReport {
  const findings: FaoFinding[] = [];
  const header = asRecord(master.headerTransport) || {};
  const children = asArray(master.atendimentosIndividuais);

  if (!children.length) {
    findings.push({
      severity: 'BLOCKER',
      code: 'FAI_ATENDIMENTO_MISSING',
      message: 'Nenhum atendimento individual no payload.',
      field: 'atendimentosIndividuais',
      rule: 'LEDI-FAI',
    });
  }

  for (const raw of children) {
    const body = asRecord(raw) || {};
    const st = body.stNaoPossuiCpf;
    if (typeof st !== 'boolean') {
      findings.push({
        severity: 'BLOCKER',
        code: 'ST_NAO_POSSUI_CPF',
        message: 'Campo stNaoPossuiCpf ausente no atendimento individual.',
        field: 'stNaoPossuiCpf',
        rule: 'LEDI-FAI',
        hint: 'Inserir false quando há CNS/CPF.',
      });
    }

    const cpf = str(body.cpfCidadao).replace(/\D/g, '');
    const cns = (str(body.cns) || str(body.cnsCidadao)).replace(/\D/g, '');
    if (!cpf && !cns) {
      findings.push({
        severity: 'BLOCKER',
        code: 'PATIENT_ID_MISSING',
        message: 'Sem CPF nem CNS do cidadão.',
        field: 'cns',
        rule: 'LEDI-FAI',
      });
    }
    if (cns && !isValidCns(cns)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CNS_INVALID',
        message: 'CNS do cidadão inválido.',
        field: 'cns',
        rule: 'LEDI-FAI',
      });
    }
    if (cpf && !isValidCpf(cpf)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CPF_INVALID',
        message: 'CPF do cidadão inválido.',
        field: 'cpfCidadao',
        rule: 'LEDI-FAI',
      });
    }
    if (st === true && (body.justificativaNaoPossuiCpf == null || body.justificativaNaoPossuiCpf === '')) {
      findings.push({
        severity: 'BLOCKER',
        code: 'JUSTIFICATIVA_CPF_MISSING',
        message: 'Informe justificativa de não possuir CPF.',
        field: 'justificativaNaoPossuiCpf',
        rule: 'LEDI-FAI',
      });
    }

    const turno = Number(body.turno);
    if (!Number.isFinite(turno) || ![1, 2, 3].includes(turno)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TURNO',
        message: `Turno inválido (${body.turno ?? 'ausente'}); use 1, 2 ou 3.`,
        field: 'turno',
        rule: 'LEDI-FAI',
      });
    }

    const nasc = str(body.dataNascimento) || str(body.dtNascimento);
    if (!nasc) {
      findings.push({
        severity: 'BLOCKER',
        code: 'DT_NASCIMENTO_MISSING',
        message: 'dtNascimento/dataNascimento ausente.',
        field: 'dataNascimento',
        rule: 'LEDI-FAI',
      });
    }

    const sexo = body.sexo;
    if (sexo !== 0 && sexo !== 1 && sexo !== '0' && sexo !== '1') {
      findings.push({
        severity: 'BLOCKER',
        code: 'SEXO_INVALID',
        message: `Sexo inválido (${sexo ?? 'ausente'}); use 0 ou 1.`,
        field: 'sexo',
        rule: 'LEDI-FAI',
      });
    }

    const local = Number(body.localDeAtendimento ?? body.localAtendimento);
    if (!Number.isFinite(local) || local < 1 || local > 10) {
      findings.push({
        severity: 'BLOCKER',
        code: 'LOCAL_ATENDIMENTO',
        message: `localAtendimento inválido (${local || 'ausente'}).`,
        field: 'localDeAtendimento',
        rule: 'LEDI-FAI',
      });
    }

    const tipo = Number(body.tipoAtendimento);
    if (!FAI_TIPO_OK.has(tipo)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TIPO_ATENDIMENTO',
        message: `tipoAtendimento FAI deve ser 1, 2, 4, 5 ou 6 (atual: ${body.tipoAtendimento ?? 'ausente'}).`,
        field: 'tipoAtendimento',
        rule: 'LEDI-FAI',
      });
    }

    const condutas = asArray(body.condutas);
    if (!condutas.length) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CONDUTA_MISSING',
        message: 'Nenhuma conduta/encaminhamento (catálogo FAI / TipoEncaminhamentoIndividual).',
        field: 'condutas',
        rule: 'LEDI-FAI',
      });
    }

    const problema = asRecord(body.problemaCondicaoAvaliada) || {};
    const ciaps = asArray(problema.ciaps).concat(asArray(body.ciap2MotivoConsulta));
    const cids = asArray(problema.cid10);
    const hasProblema = ciaps.some((x) => str(x)) || cids.some((x) => str(x));
    if (!hasProblema) {
      findings.push({
        severity: 'BLOCKER',
        code: 'PROBLEMAS_MISSING',
        message: 'Informe ao menos um CIAP ou CID-10.',
        field: 'problemasCondicoes',
        rule: 'LEDI-FAI',
      });
    }
  }

  const lotacao = asRecord(header.lotacaoFormPrincipal) || header;
  const cnes = (str(lotacao.cnes) || str(header.cnes)).replace(/\D/g, '');
  if (!cnes) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_MISSING',
      message: 'CNES ausente.',
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  } else if (cnes.length !== 7) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_FORMAT',
      message: `CNES deve ter 7 dígitos (atual: ${cnes.length}).`,
      field: 'cnes',
      rule: 'LEDI-FAI',
    });
  }

  const ineLot = (str(lotacao.ine) || str(header.ine)).replace(/\D/g, '');
  if (!ineLot) {
    findings.push({
      severity: 'QUALITY_WARN',
      code: 'INE_MISSING',
      message: 'INE ausente na lotação/envelope.',
      field: 'ine',
      rule: 'LEDI-FAI',
    });
  }

  return buildFaiReport(findings, 'json', 'ledi-individual-v2');
}

function buildFaiReport(
  findings: FaoFinding[],
  sourceKind: 'xml' | 'json',
  detectedFormat: string,
): FaiValidationReport {
  const blockers = count(findings, 'BLOCKER');
  const moneyRisks = count(findings, 'MONEY_RISK');
  const qualityWarns = count(findings, 'QUALITY_WARN');
  const infos = count(findings, 'INFO');
  const siapsReady = blockers === 0;
  return {
    conformant: siapsReady && moneyRisks === 0,
    siapsReady,
    previneReady: true,
    readyForFinalSend: siapsReady,
    channel: 'LEDI_FAI_SIAPS',
    sourceKind,
    detectedFormat,
    summary: { blockers, moneyRisks, qualityWarns, infos },
    findings,
  };
}

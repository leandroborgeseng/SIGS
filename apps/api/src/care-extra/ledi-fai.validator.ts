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
    sourceKind: 'xml',
    detectedFormat: 'LEDI_FAI_XML',
    summary: { blockers, moneyRisks, qualityWarns, infos },
    findings,
  };
}

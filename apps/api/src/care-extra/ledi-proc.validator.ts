/**
 * Validador estrutural LEDI — Ficha de Procedimentos (tipo 7).
 */

import { isValidCns, isValidCpf, type FaoFinding, type FaoSeverity } from './ledi-fao.validator';
import { detectLediFichaTipo } from './ledi-ficha-tipo';

export type ProcValidationReport = {
  conformant: boolean;
  siapsReady: boolean;
  previneReady: boolean;
  readyForFinalSend: boolean;
  channel: 'LEDI_PROC_SIAPS';
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
  const re = /<atendProcedimentos\b[^>]*>([\s\S]*?)<\/atendProcedimentos>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) blocks.push(m[1]);
  return blocks;
}

export function validateProcXml(xml: string): ProcValidationReport {
  const findings: FaoFinding[] = [];
  const tipo = detectLediFichaTipo(xml);

  if (tipo.id !== 'PROCEDIMENTOS') {
    findings.push({
      severity: 'BLOCKER',
      code: 'WRONG_FICHA_TIPO',
      message: `Esperado Procedimentos (7); detectado ${tipo.label} (${tipo.code ?? '?'}).`,
      field: 'tipoDadoSerializado',
      rule: 'LEDI-tipo',
      hint: tipo.correctionPath,
    });
  }

  if (!/fichaProcedimentoMasterTransport/i.test(xml)) {
    findings.push({
      severity: 'BLOCKER',
      code: 'PROC_ROOT_NOT_FOUND',
      message: 'Raiz fichaProcedimentoMasterTransport não encontrada.',
      field: 'master',
      rule: 'LEDI-PROC',
    });
  }

  const blocks = eachAtendimento(xml);
  if (!blocks.length) {
    findings.push({
      severity: 'BLOCKER',
      code: 'PROC_ATENDIMENTO_MISSING',
      message: 'Nenhum bloco atendProcedimentos.',
      field: 'atendProcedimentos',
      rule: 'LEDI-PROC',
    });
  }

  for (const body of blocks) {
    if (!/<stNaoPossuiCpf\b/i.test(body)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'ST_NAO_POSSUI_CPF',
        message: 'Campo stNaoPossuiCpf ausente no atendimento de procedimentos.',
        field: 'stNaoPossuiCpf',
        rule: 'LEDI-PROC',
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
        rule: 'LEDI-PROC',
      });
    }
    if (cns && !isValidCns(cns)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CNS_INVALID',
        message: 'CNS do cidadão inválido.',
        field: 'cnsCidadao',
        rule: 'LEDI-PROC',
      });
    }
    if (cpf && !isValidCpf(cpf)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CPF_INVALID',
        message: 'CPF do cidadão inválido.',
        field: 'cpfCidadao',
        rule: 'LEDI-PROC',
      });
    }

    const turno = Number(body.match(/<turno>\s*([^<]+)/i)?.[1]?.trim());
    if (!Number.isFinite(turno) || ![1, 2, 3].includes(turno)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'TURNO',
        message: `Turno inválido (${turno || 'ausente'}); use 1, 2 ou 3.`,
        field: 'turno',
        rule: 'LEDI-PROC',
      });
    }

    if (!/<dtNascimento\b/i.test(body)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'DT_NASCIMENTO_MISSING',
        message: 'dtNascimento ausente.',
        field: 'dtNascimento',
        rule: 'LEDI-PROC',
      });
    }

    const sexo = body.match(/<sexo>\s*([^<]+)/i)?.[1]?.trim();
    if (sexo == null || sexo === '' || !['0', '1'].includes(sexo)) {
      findings.push({
        severity: 'BLOCKER',
        code: 'SEXO_INVALID',
        message: `Sexo inválido (${sexo ?? 'ausente'}); use 0 ou 1.`,
        field: 'sexo',
        rule: 'LEDI-PROC',
      });
    }

    const local = Number(body.match(/<localAtendimento>\s*([^<]+)/i)?.[1]?.trim());
    if (!Number.isFinite(local) || local < 1 || local > 10) {
      findings.push({
        severity: 'BLOCKER',
        code: 'LOCAL_ATENDIMENTO',
        message: `localAtendimento inválido (${local || 'ausente'}).`,
        field: 'localAtendimento',
        rule: 'LEDI-PROC',
      });
    }

    const procCodes = [...body.matchAll(/<procedimentos>\s*([^<]+)\s*<\/procedimentos>/gi)].map((m) =>
      m[1].trim(),
    );
    if (!procCodes.length) {
      findings.push({
        severity: 'MONEY_RISK',
        code: 'PROC_CODE_EMPTY',
        message: 'Sem código em <procedimentos>.',
        field: 'procedimentos',
        rule: 'LEDI-PROC',
      });
    }
    for (const code of procCodes) {
      if (/^ABPG/i.test(code)) {
        findings.push({
          severity: 'BLOCKER',
          code: 'PROC_CODE_ABPG',
          message: `Código ABPG (${code}) — LEDI espera SIGTAP 10 dígitos em <procedimentos>.`,
          field: 'procedimentos',
          rule: 'LEDI-PROC',
          hint: 'Mapear ABPG → SIGTAP oficial.',
        });
      } else if (!/^\d{10}$/.test(code.replace(/\D/g, '')) && code.replace(/\D/g, '').length !== 10) {
        const digits = code.replace(/\D/g, '');
        if (digits.length !== 10) {
          findings.push({
            severity: 'MONEY_RISK',
            code: 'PROC_CODE_FORMAT',
            message: `Procedimento "${code}" não tem 10 dígitos SIGTAP.`,
            field: 'procedimentos',
            rule: 'LEDI-PROC',
          });
        }
      }
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
      rule: 'LEDI-PROC',
    });
  } else if (cnes.length !== 7) {
    findings.push({
      severity: 'BLOCKER',
      code: 'CNES_FORMAT',
      message: `CNES deve ter 7 dígitos (atual: ${cnes.length}).`,
      field: 'cnes',
      rule: 'LEDI-PROC',
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
      rule: 'LEDI-PROC',
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
    readyForFinalSend: siapsReady && moneyRisks === 0,
    channel: 'LEDI_PROC_SIAPS',
    sourceKind: 'xml',
    detectedFormat: 'LEDI_PROC_XML',
    summary: { blockers, moneyRisks, qualityWarns, infos },
    findings,
  };
}

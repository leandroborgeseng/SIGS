/**
 * Cruzamento produção × Paciente Mestre (P×2).
 * MONEY_RISK se CNS/CPF do cidadão não existir no mestre local.
 * Não cria paciente — só finding (Previne / denominador).
 */

import type { FaoFinding, FaoSeverity } from './ledi-fao.validator';

export type LediCidadaoMasterCtx = {
  /** CNS (15 dígitos) conhecidos no Paciente Mestre / identifiers */
  knownCns: ReadonlySet<string>;
  /** CPF (11 dígitos) conhecidos */
  knownCpf: ReadonlySet<string>;
};

export type CidadaoIds = { cns: string; cpf: string };

const CODE_BY_TIPO: Record<string, string> = {
  FAO: 'FAO_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  FAI: 'FAI_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  PROCEDIMENTOS: 'PROC_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  PROC: 'PROC_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  AD: 'AD_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  VISITA_ACS: 'VISITA_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  VACINA: 'VACINA_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  COLETIVO: 'COLETIVO_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
};

function push(
  findings: FaoFinding[],
  severity: FaoSeverity,
  code: string,
  message: string,
  extra?: Partial<FaoFinding>,
) {
  findings.push({ severity, code, message, rule: extra?.rule || 'P×2-mestre', ...extra });
}

/** Extrai CNS/CPF do cidadão em XML LEDI (primeiro bloco encontrado). */
export function extractCidadaoIdsFromXml(xml: string): CidadaoIds {
  const cns =
    xml.match(/<cnsCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    xml.match(/<cnsCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') ||
    '';
  const cpf = xml.match(/<cpfCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
  return {
    cns: cns.length === 15 ? cns : cns,
    cpf: cpf.length === 11 ? cpf : cpf,
  };
}

export function extractCidadaoIdsFromPayload(payload: Record<string, unknown>): CidadaoIds {
  const dig = (v: unknown) => String(v || '').replace(/\D/g, '');
  const nested = (payload.atendimento ||
    payload.ficha ||
    payload.dados ||
    {}) as Record<string, unknown>;
  const cns =
    dig(payload.cnsCidadao) ||
    dig(payload.patientCns) ||
    dig(payload.cns) ||
    dig(nested.cnsCidadao) ||
    dig((payload.patient as Record<string, unknown> | undefined)?.cns);
  const cpf =
    dig(payload.cpfCidadao) ||
    dig(payload.patientCpf) ||
    dig(payload.cpf) ||
    dig(nested.cpfCidadao) ||
    dig((payload.patient as Record<string, unknown> | undefined)?.cpf);
  return { cns, cpf };
}

export function findingCodeForTipo(tipo: string): string {
  const key = String(tipo || '')
    .toUpperCase()
    .replace(/-/g, '_');
  if (CODE_BY_TIPO[key]) return CODE_BY_TIPO[key];
  if (/FAO|DENTAL|ODONTO/.test(key)) return CODE_BY_TIPO.FAO;
  if (/FAI|INDIVIDUAL_ENCOUNTER|CONSULTA/.test(key)) return CODE_BY_TIPO.FAI;
  if (/PROC/.test(key)) return CODE_BY_TIPO.PROCEDIMENTOS;
  if (/AD|HOME_CARE/.test(key)) return CODE_BY_TIPO.AD;
  if (/VISITA/.test(key)) return CODE_BY_TIPO.VISITA_ACS;
  if (/VAC/.test(key)) return CODE_BY_TIPO.VACINA;
  if (/COLET/.test(key)) return CODE_BY_TIPO.COLETIVO;
  return 'PROD_CNS_NOT_IN_CADASTRO_INDIVIDUAL';
}

/**
 * Se há CNS ou CPF na ficha e nenhum está no mestre → MONEY_RISK.
 * Sem identificador na ficha: não emite (já coberto por regras de identidade).
 * Se ctx vazio (mestre sem pacientes): não emite (evita falso positivo em base virgem).
 */
export function appendCidadaoMasterCrossChecks(
  findings: FaoFinding[],
  ids: CidadaoIds,
  tipo: string,
  ctx?: LediCidadaoMasterCtx | null,
) {
  if (!ctx) return;
  if (!ctx.knownCns.size && !ctx.knownCpf.size) return;

  const cns = (ids.cns || '').replace(/\D/g, '');
  const cpf = (ids.cpf || '').replace(/\D/g, '');
  if (!cns && !cpf) return;

  const cnsOk = cns.length === 15 && ctx.knownCns.has(cns);
  const cpfOk = cpf.length === 11 && ctx.knownCpf.has(cpf);
  if (cnsOk || cpfOk) return;

  const label = cns ? `CNS ${cns}` : `CPF ${cpf}`;
  push(
    findings,
    'MONEY_RISK',
    findingCodeForTipo(tipo),
    `${label} não encontrado no Paciente Mestre / cadastro individual local.`,
    {
      field: cns ? 'cnsCidadao' : 'cpfCidadao',
      hint: 'Cadastre ou vincule o cidadão em /pacientes (tipo 2 / identifiers CNS|CPF) antes de maximizar Previne.',
      rule: 'P×2-mestre',
    },
  );
}

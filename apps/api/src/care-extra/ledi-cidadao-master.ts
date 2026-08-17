/**
 * Cruzamento produção × Paciente Mestre (P×2).
 * MONEY_RISK se CNS/CPF do cidadão não existir no mestre local.
 * Não cria paciente — só finding (Previne / denominador).
 * AD / visita / coletivo: extrai **todos** os CNS/CPF dos blocos filho quando existirem.
 */

import type { FaoFinding, FaoSeverity } from './ledi-fao.validator';

export type LediCidadaoMasterCtx = {
  /** CNS (15 dígitos) conhecidos no Paciente Mestre / identifiers */
  knownCns: ReadonlySet<string>;
  /** CPF (11 dígitos) conhecidos */
  knownCpf: ReadonlySet<string>;
  /** DN por CNS/CPF — usado em faixas (ex. B4 coletivo) quando disponível */
  birthDateByCns?: ReadonlyMap<string, Date>;
  birthDateByCpf?: ReadonlyMap<string, Date>;
};

export type CidadaoIds = { cns: string; cpf: string; birthDate?: string | null };

const CODE_BY_TIPO: Record<string, string> = {
  FAO: 'FAO_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  FAI: 'FAI_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  PROCEDIMENTOS: 'PROC_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  PROC: 'PROC_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  AD: 'AD_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  VISITA_ACS: 'VISITA_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  VACINA: 'VACINA_CNS_NOT_IN_CADASTRO_INDIVIDUAL',
  COLETIVO: 'COLETIVO_PARTICIPANTE_NOT_IN_CADASTRO',
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

function digOnly(v: unknown): string {
  return String(v || '').replace(/\D/g, '');
}

function idsFromRecord(r: Record<string, unknown>): CidadaoIds {
  const nested = (r.atendimento || r.ficha || r.dados || r.patient || {}) as Record<string, unknown>;
  const cns =
    digOnly(r.cnsCidadao) ||
    digOnly(r.patientCns) ||
    digOnly(r.cns) ||
    digOnly(nested.cnsCidadao) ||
    digOnly(nested.cns);
  const cpf =
    digOnly(r.cpfCidadao) ||
    digOnly(r.patientCpf) ||
    digOnly(r.cpf) ||
    digOnly(nested.cpfCidadao) ||
    digOnly(nested.cpf);
  const birthRaw =
    r.dataNascimento ?? r.birthDate ?? nested.dataNascimento ?? nested.birthDate ?? null;
  const birthDate =
    birthRaw == null || birthRaw === ''
      ? null
      : birthRaw instanceof Date
        ? birthRaw.toISOString().slice(0, 10)
        : String(birthRaw);
  return { cns, cpf, birthDate };
}

function dedupeIds(list: CidadaoIds[]): CidadaoIds[] {
  const seen = new Set<string>();
  const out: CidadaoIds[] = [];
  for (const ids of list) {
    const cns = (ids.cns || '').replace(/\D/g, '');
    const cpf = (ids.cpf || '').replace(/\D/g, '');
    if (!cns && !cpf) continue;
    const key = `${cns}|${cpf}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ cns, cpf, birthDate: ids.birthDate ?? null });
  }
  return out;
}

/** Extrai CNS/CPF do cidadão em XML LEDI (primeiro bloco encontrado). */
export function extractCidadaoIdsFromXml(xml: string): CidadaoIds {
  const all = extractAllCidadaoIdsFromXml(xml);
  return all[0] || { cns: '', cpf: '', birthDate: null };
}

/**
 * Todos os cidadãos com CNS/CPF no XML (AD multi-child, visitas, participantes coletivo).
 * Sem lista nominal no XML → array vazio ou só o primeiro bloco encontrado.
 */
export function extractAllCidadaoIdsFromXml(xml: string): CidadaoIds[] {
  const out: CidadaoIds[] = [];
  const blockRe =
    /<(atendimentosDomiciliares|visitasDomiciliares|participante|participantes|cidadao|fichaAtendimentoIndividualChild|fichaAtendimentoOdontologicoChild)[^>]*>[\s\S]*?<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml))) {
    const block = m[0];
    const cns = block.match(/<cnsCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
    const cpf = block.match(/<cpfCidadao>\s*([^<]+)/i)?.[1]?.replace(/\D/g, '') || '';
    const birthDate =
      block.match(/<dataNascimento>\s*([^<]+)/i)?.[1]?.trim() ||
      block.match(/<dtNascimento>\s*([^<]+)/i)?.[1]?.trim() ||
      null;
    if (cns || cpf) out.push({ cns, cpf, birthDate });
  }
  if (!out.length) {
    // Fallback: tags soltas (ex. um único cnsCidadao no root)
    const cnsTags = [...xml.matchAll(/<cnsCidadao>\s*([^<]+)/gi)].map((x) =>
      x[1]!.replace(/\D/g, ''),
    );
    const cpfTags = [...xml.matchAll(/<cpfCidadao>\s*([^<]+)/gi)].map((x) =>
      x[1]!.replace(/\D/g, ''),
    );
    const n = Math.max(cnsTags.length, cpfTags.length);
    for (let i = 0; i < n; i++) {
      out.push({ cns: cnsTags[i] || '', cpf: cpfTags[i] || '', birthDate: null });
    }
  }
  return dedupeIds(out);
}

export function extractCidadaoIdsFromPayload(payload: Record<string, unknown>): CidadaoIds {
  const all = extractAllCidadaoIdsFromPayload(payload);
  return all[0] || { cns: '', cpf: '', birthDate: null };
}

/** AD / visita / coletivo: lista de cidadãos no payload JSON LEDI. */
export function extractAllCidadaoIdsFromPayload(payload: Record<string, unknown>): CidadaoIds[] {
  const out: CidadaoIds[] = [];
  const arrays = [
    payload.atendimentosDomiciliares,
    payload.visitasDomiciliares,
    payload.participantes,
    payload.cidadaos,
    payload.children,
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      out.push(idsFromRecord(item as Record<string, unknown>));
    }
  }
  const transport = payload.fichaAdTransport || payload.fichaAtividadeColetivaTransport;
  if (transport && typeof transport === 'object') {
    out.push(idsFromRecord(transport as Record<string, unknown>));
  }
  out.push(idsFromRecord(payload));
  return dedupeIds(out);
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

/** P×2 para N cidadãos (AD multi-child, participantes coletivo, visitas). */
export function appendCidadaoMasterCrossChecksMany(
  findings: FaoFinding[],
  list: CidadaoIds[],
  tipo: string,
  ctx?: LediCidadaoMasterCtx | null,
) {
  for (const ids of list) {
    appendCidadaoMasterCrossChecks(findings, ids, tipo, ctx);
  }
}

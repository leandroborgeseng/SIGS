/**
 * Coletivo × B4 (escovação supervisionada) — faixa etária 6–12 anos.
 * Só emite quando há participantes com idade resolúvel (XML DN ou Paciente Mestre).
 * Domínio nativo `/coletivo` só tem contagem → gap documentado, sem finding inventado.
 */

import type { FaoFinding, FaoSeverity } from './ledi-fao.validator';
import type { CidadaoIds, LediCidadaoMasterCtx } from './ledi-cidadao-master';

export const CODE_COLETIVO_B4_SEM_FAIXA = 'COLETIVO_B4_SEM_FAIXA_6_12';

/** 01.01.02.003-1 (oficial Previne) + 0101050011 (catálogo stub local /coletivo). */
export const B4_ESCOVACAO_CODES = new Set(['0101020031', '0101050011']);

export type ColetivoB4Participant = CidadaoIds & {
  /** Idade em anos completos na data da atividade; se ausente, tenta DN / mestre */
  ageYears?: number | null;
  birthDate?: Date | string | null;
};

function push(
  findings: FaoFinding[],
  severity: FaoSeverity,
  code: string,
  message: string,
  extra?: Partial<FaoFinding>,
) {
  findings.push({
    severity,
    code,
    message,
    rule: extra?.rule || '6×B4-faixa',
    ...extra,
  });
}

export function isB4EscovacaoCode(raw: string): boolean {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 10 && B4_ESCOVACAO_CODES.has(d);
}

export function hasB4Escovacao(procedureCodes: string[]): boolean {
  return procedureCodes.some(isB4EscovacaoCode);
}

function ageFromBirth(birth: Date, ref: Date): number {
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const m = ref.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function parseBirth(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = String(v).trim();
  if (/^\d{13,}$/.test(s)) {
    const d = new Date(Number(s));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveAge(
  p: ColetivoB4Participant,
  ref: Date,
  master?: LediCidadaoMasterCtx | null,
): number | null {
  if (typeof p.ageYears === 'number' && Number.isFinite(p.ageYears)) return p.ageYears;
  const fromSelf = parseBirth(p.birthDate);
  if (fromSelf) return ageFromBirth(fromSelf, ref);
  const cns = (p.cns || '').replace(/\D/g, '');
  const cpf = (p.cpf || '').replace(/\D/g, '');
  const fromMaster =
    (cns.length === 15 && master?.birthDateByCns?.get(cns)) ||
    (cpf.length === 11 && master?.birthDateByCpf?.get(cpf)) ||
    null;
  if (fromMaster) return ageFromBirth(fromMaster, ref);
  return null;
}

/**
 * Se a atividade tem proc B4 e há participantes com idade conhecida fora de 6–12 → MONEY_RISK.
 * Sem participantes com idade: no-op (não inventa lista CNS do domínio contagem-only).
 */
export function appendColetivoB4FaixaChecks(
  findings: FaoFinding[],
  opts: {
    procedureCodes: string[];
    participants: ColetivoB4Participant[];
    referenceDate?: Date | null;
    master?: LediCidadaoMasterCtx | null;
  },
) {
  if (!hasB4Escovacao(opts.procedureCodes)) return;
  const ref = opts.referenceDate || new Date();
  let checked = 0;
  for (const p of opts.participants) {
    const age = resolveAge(p, ref, opts.master);
    if (age == null) continue;
    checked += 1;
    if (age >= 6 && age <= 12) continue;
    const label = p.cns
      ? `CNS ${p.cns}`
      : p.cpf
        ? `CPF ${p.cpf}`
        : 'participante';
    push(
      findings,
      'MONEY_RISK',
      CODE_COLETIVO_B4_SEM_FAIXA,
      `${label} com idade ${age} anos fora da faixa 6–12 do B4 (escovação supervisionada).`,
      {
        field: 'participantes',
        hint: 'B4 conta apenas crianças 6–12 anos na atividade coletiva com proc 01.01.02.003-1 (ou stub 0101050011).',
        rule: '6×B4-faixa',
      },
    );
  }
  return checked;
}

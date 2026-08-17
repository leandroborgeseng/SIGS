/**
 * Cruzamento produção × vínculo paciente↔equipe (NT 30 / P×2c).
 * MONEY_RISK se cidadão conhecido no mestre sem vínculo ativo, ou INE do header ≠ vínculo.
 * Não inventa vínculo — só finding (Previne / denominador).
 */

import { normalizeIne } from '../cnes/cnes.snapshot';
import type { FaoFinding, FaoSeverity } from './ledi-fao.validator';

export const CODE_PRODUCAO_SEM_VINCULO = 'PRODUCAO_SEM_VINCULO_EQUIPE';
export const CODE_PRODUCAO_INE_NEQ = 'PRODUCAO_INE_NEQ_VINCULO';

export type VinculoPatientRef = {
  patientId: string;
  /** INEs de vínculos ativos (já normalizados quando possível) */
  ines: string[];
};

export type LediVinculoNt30Ctx = {
  byPatientId: ReadonlyMap<string, VinculoPatientRef>;
  byCns: ReadonlyMap<string, VinculoPatientRef>;
  byCpf: ReadonlyMap<string, VinculoPatientRef>;
  /** Pacientes indexados no mestre (com CNS/CPF/id) — para saber se o cidadão é conhecido */
  knownPatientIds: ReadonlySet<string>;
  knownCns: ReadonlySet<string>;
  knownCpf: ReadonlySet<string>;
  stats: {
    activeLinks: number;
    patientsWithActiveLink: number;
    patientsIndexed: number;
  };
};

export type VinculoIds = {
  patientId?: string;
  cns?: string;
  cpf?: string;
  /** INE do cabeçalho da produção */
  headerIne?: string;
};

function push(
  findings: FaoFinding[],
  severity: FaoSeverity,
  code: string,
  message: string,
  extra?: Partial<FaoFinding>,
) {
  findings.push({ severity, code, message, rule: extra?.rule || 'P×2c-NT30', ...extra });
}

export function resolveVinculoRef(
  ids: VinculoIds,
  ctx: LediVinculoNt30Ctx,
): VinculoPatientRef | null {
  if (ids.patientId && ctx.byPatientId.has(ids.patientId)) {
    return ctx.byPatientId.get(ids.patientId)!;
  }
  const cns = (ids.cns || '').replace(/\D/g, '');
  if (cns.length === 15 && ctx.byCns.has(cns)) return ctx.byCns.get(cns)!;
  const cpf = (ids.cpf || '').replace(/\D/g, '');
  if (cpf.length === 11 && ctx.byCpf.has(cpf)) return ctx.byCpf.get(cpf)!;
  return null;
}

/** Cidadão existe no mestre (identifiers / patientId), independentemente de vínculo. */
export function isCidadaoKnownInMaster(ids: VinculoIds, ctx: LediVinculoNt30Ctx): boolean {
  if (ids.patientId && ctx.knownPatientIds.has(ids.patientId)) return true;
  const cns = (ids.cns || '').replace(/\D/g, '');
  if (cns.length === 15 && ctx.knownCns.has(cns)) return true;
  const cpf = (ids.cpf || '').replace(/\D/g, '');
  if (cpf.length === 11 && ctx.knownCpf.has(cpf)) return true;
  return false;
}

/**
 * Emite findings NT 30 quando o cidadão é conhecido no mestre.
 * Sem identificador / cidadão fora do mestre: no-op (P×2 cobre ausência).
 * Ctx sem nenhum paciente indexado: no-op (base virgem).
 */
export function appendVinculoNt30CrossChecks(
  findings: FaoFinding[],
  ids: VinculoIds,
  ctx?: LediVinculoNt30Ctx | null,
) {
  if (!ctx) return;
  if (!ctx.stats.patientsIndexed) return;
  if (!isCidadaoKnownInMaster(ids, ctx)) return;

  const ref = resolveVinculoRef(ids, ctx);
  const label =
    ids.patientId ||
    ((ids.cns || '').replace(/\D/g, '').length === 15
      ? `CNS ${(ids.cns || '').replace(/\D/g, '')}`
      : `CPF ${(ids.cpf || '').replace(/\D/g, '')}`);

  if (!ref || !ref.ines.length) {
    push(
      findings,
      'MONEY_RISK',
      CODE_PRODUCAO_SEM_VINCULO,
      `Cidadão ${label} sem vínculo ativo paciente↔equipe (NT 30 / denominador Previne).`,
      {
        field: 'patientTeamLink',
        hint: 'Crie vínculo em /territorio (aba Vínculos) com a equipe/INE do cabeçalho.',
        rule: 'P×2c-NT30',
      },
    );
    return;
  }

  const headerIne = normalizeIne(ids.headerIne || '') || (ids.headerIne || '').trim();
  if (!headerIne) return; // INE_MISSING já cobre ausência no header

  const match = ref.ines.some((ine) => ine === headerIne);
  if (!match) {
    push(
      findings,
      'MONEY_RISK',
      CODE_PRODUCAO_INE_NEQ,
      `INE do cabeçalho (${headerIne}) ≠ vínculos ativos do cidadão (${ref.ines.join(', ')}).`,
      {
        field: 'ine',
        hint: 'Ajuste o INE do lote/lotação ou o vínculo em /territorio para a mesma equipe.',
        rule: 'P×2c-NT30',
      },
    );
  }
}

/** Nota honesta quando a base de vínculos é fraca vs pacientes indexados. */
export function vinculoCoverageNote(stats: LediVinculoNt30Ctx['stats']): string | null {
  if (!stats.patientsIndexed) {
    return 'Paciente Mestre vazio — cruzamento NT 30 não emitiu findings (evita falso positivo).';
  }
  if (!stats.activeLinks) {
    return 'Nenhum patient-team-link ativo — toda produção de cidadão conhecido gera PRODUCAO_SEM_VINCULO_EQUIPE até popular /territorio.';
  }
  const ratio = stats.patientsWithActiveLink / Math.max(stats.patientsIndexed, 1);
  if (ratio < 0.15) {
    return `Cobertura de vínculo baixa (${stats.patientsWithActiveLink}/${stats.patientsIndexed} pacientes com link ativo). Findings NT 30 são honestos, mas a amostra de vínculos ainda é fraca.`;
  }
  return null;
}

/**
 * Cruzamentos território / domicílio (2×3 · 8×3) — qualidade Previne C2–C6.
 * Só emite quando o modelo local tem household; sem fingir ZIP tipo 3.
 */

import type { FaoFinding, FaoSeverity } from './ledi-fao.validator';

export const CODE_CADASTRO_SEM_DOMICILIO = 'CADASTRO_SEM_DOMICILIO';
export const CODE_VISITA_HOUSEHOLD_NOT_FOUND = 'VISITA_HOUSEHOLD_NOT_FOUND';

export type TerritorioHouseholdCtx = {
  /** Pacientes membros ativos ou responsáveis de família ativa */
  patientIdsWithHousehold: ReadonlySet<string>;
  /** Domicílios ativos conhecidos */
  activeHouseholdIds: ReadonlySet<string>;
  /** Há ao menos 1 household no município (evita falso positivo em base virgem) */
  householdsPresent: boolean;
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
    rule: extra?.rule || '2×3-territorio',
    ...extra,
  });
}

/**
 * Paciente conhecido sem vínculo com domicílio ativo → MONEY_RISK (território / VD).
 * No-op se não houver households no banco (base sem território).
 */
export function appendCadastroSemDomicilio(
  findings: FaoFinding[],
  patientId: string | null | undefined,
  ctx?: TerritorioHouseholdCtx | null,
) {
  if (!ctx?.householdsPresent || !patientId) return;
  if (ctx.patientIdsWithHousehold.has(patientId)) return;
  push(
    findings,
    'MONEY_RISK',
    CODE_CADASTRO_SEM_DOMICILIO,
    'Paciente sem domicílio/família ativo no território (tipo 2 × tipo 3).',
    {
      field: 'household',
      hint: 'Vincule o cidadão a um domicílio em /territorio (membro ou responsável).',
      rule: '2×3-territorio',
    },
  );
}

/**
 * Visita ACS: householdId informado mas ausente/inativo, ou visita só com paciente
 * que não tem domicílio e sem householdId na visita.
 */
export function appendVisitaHouseholdFindings(
  findings: FaoFinding[],
  visit: {
    householdId?: string | null;
    patientId?: string | null;
  },
  ctx?: TerritorioHouseholdCtx | null,
) {
  if (!ctx?.householdsPresent) return;

  const hh = (visit.householdId || '').trim();
  if (hh) {
    if (!ctx.activeHouseholdIds.has(hh)) {
      push(
        findings,
        'QUALITY_WARN',
        CODE_VISITA_HOUSEHOLD_NOT_FOUND,
        `Domicílio ${hh.slice(0, 8)}… da visita ACS não encontrado ou inativo.`,
        {
          field: 'householdId',
          hint: 'Corrija o householdId em /territorio ou reative o domicílio.',
          rule: '8×3-visita',
        },
      );
    }
    return;
  }

  // Sem householdId: se há paciente, ele deveria ter domicílio para VD contar território
  if (visit.patientId && !ctx.patientIdsWithHousehold.has(visit.patientId)) {
    push(
      findings,
      'QUALITY_WARN',
      CODE_VISITA_HOUSEHOLD_NOT_FOUND,
      'Visita ACS sem domicílio e paciente sem família ativa no território.',
      {
        field: 'householdId',
        hint: 'Informe householdId na visita ou cadastre o paciente em um domicílio (/territorio).',
        rule: '8×3-visita',
      },
    );
  }
}

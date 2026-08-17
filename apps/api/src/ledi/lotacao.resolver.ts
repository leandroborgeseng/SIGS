/** Resolve lotação (CNS+CBO+CNES+INE) para header LEDI. */

export type LotacaoHeader = {
  profissionalCNS: string;
  cboCodigo_2002: string;
  cnes: string;
  ine?: string | null;
  assignmentId?: string | null;
};

export type AssignmentLike = {
  id: string;
  professionalId: string;
  facilityId: string;
  teamId?: string | null;
  cbo: string;
  active: boolean;
  team?: { ine?: string | null } | null;
  professional?: { cns?: string | null } | null;
  facility?: { cnes?: string } | null;
};

export type ResolveLotacaoInput = {
  facilityCnes: string;
  professionalCns?: string | null;
  teamIne?: string | null;
  /** Override explícito (finish com CBO digitado) */
  cboOverride?: string | null;
  assignmentId?: string | null;
  assignments: AssignmentLike[];
  professionalId?: string | null;
  facilityId?: string | null;
  teamId?: string | null;
};

export function pickActiveAssignment(
  assignments: AssignmentLike[],
  opts: {
    professionalId?: string | null;
    facilityId?: string | null;
    teamId?: string | null;
    assignmentId?: string | null;
  },
): AssignmentLike | null {
  const active = assignments.filter((a) => a.active);
  if (opts.assignmentId) {
    return active.find((a) => a.id === opts.assignmentId) ?? null;
  }
  let pool = active;
  if (opts.professionalId) {
    pool = pool.filter((a) => a.professionalId === opts.professionalId);
  }
  if (opts.facilityId) {
    pool = pool.filter((a) => a.facilityId === opts.facilityId);
  }
  if (!pool.length) return null;
  if (opts.teamId) {
    const byTeam = pool.find((a) => a.teamId === opts.teamId);
    if (byTeam) return byTeam;
  }
  return pool[0];
}

export function resolveLotacaoHeader(input: ResolveLotacaoInput): LotacaoHeader {
  const assignment = pickActiveAssignment(input.assignments, {
    professionalId: input.professionalId,
    facilityId: input.facilityId,
    teamId: input.teamId,
    assignmentId: input.assignmentId,
  });

  const cbo = (input.cboOverride || assignment?.cbo || '').trim();
  const cns =
    (assignment?.professional?.cns || input.professionalCns || '').trim() || null;
  const cnes = (assignment?.facility?.cnes || input.facilityCnes || '').trim();
  const ine =
    assignment?.team?.ine ??
    input.teamIne ??
    null;

  if (!cnes) {
    throw new Error('CNES da unidade obrigatório no header LEDI');
  }
  if (!cns) {
    throw new Error(
      'CNS do profissional ausente — cadastre CNS e/ou lotação ativa em /lotacoes',
    );
  }
  if (!cbo || !/^\d{4,6}$/.test(cbo)) {
    throw new Error(
      'CBO 2002 obrigatório (lotação ativa ou cbo no finish) — cadastre em /lotacoes',
    );
  }

  // Equipe municipal com INE no CNES → INE obrigatório no header LEDI
  const teamHasIne = Boolean(
    (assignment?.team?.ine && String(assignment.team.ine).replace(/\D/g, '').length >= 10) ||
      (input.teamIne && String(input.teamIne).replace(/\D/g, '').length >= 10),
  );
  const ineDigits = (ine || '').replace(/\D/g, '');
  if (teamHasIne && ineDigits.length < 10) {
    throw new Error(
      'INE obrigatório — a equipe da lotação tem INE no CNES municipal. Selecione a lotação com equipe em /lotacoes.',
    );
  }

  return {
    profissionalCNS: cns,
    cboCodigo_2002: cbo,
    cnes,
    ine: ineDigits || ine,
    assignmentId: assignment?.id ?? null,
  };
}

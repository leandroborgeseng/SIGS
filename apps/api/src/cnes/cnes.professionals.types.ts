/** Snapshot públicos CNES de profissionais lotados (nome + CNS + CBO; sem CPF / sem pacientes). */

export type CnesProfessionalRow = {
  cns: string;
  civilName: string;
};

export type CnesAssignmentRow = {
  cns: string;
  cnes: string;
  ine: string;
  cbo: string;
  roleLabel?: string | null;
  teamTypeId?: string | null;
  active?: boolean;
};

export type CnesProfessionalsSnapshot = {
  meta: {
    ibgeCode: string;
    municipality?: string;
    uf?: string;
    source?: string;
    scope?: string;
    generatedAt?: string;
    counts?: Record<string, number>;
    note?: string;
  };
  professionals: CnesProfessionalRow[];
  assignments: CnesAssignmentRow[];
  errors?: Array<{ cnes?: string; ine?: string; error: string }>;
};

export type CnesProfessionalsSyncResult = {
  ibgeCode: string;
  source: 'snapshot' | 'live';
  professionals: { created: number; updated: number; skipped: number };
  assignments: { created: number; updated: number; skipped: number };
  totals: { professionals: number; assignments: number; teamsQueried?: number };
  snapshotPath?: string;
};

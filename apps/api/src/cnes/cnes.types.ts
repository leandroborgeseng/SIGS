/** Snapshot normalizado CNES (sem PHI / sem profissionais lotados). */

export type CnesAddress = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type CnesEstablishment = {
  cnes: string;
  name: string;
  typeId?: string | null;
  cnpj?: string | null;
  active: boolean;
  ibgeCode: string;
  address?: CnesAddress | null;
};

export type CnesTeam = {
  cnes: string;
  ine: string;
  name: string;
  teamTypeId: string;
  teamTypeLabel?: string | null;
  area?: string | null;
  active?: boolean;
};

export type CnesSnapshotMeta = {
  ibgeCode: string;
  municipality?: string;
  uf?: string;
  sourceEstablishments?: string;
  sourceTeams?: string;
  generatedAt?: string;
  counts?: {
    establishments?: number;
    teams?: number;
    establishmentsActive?: number;
  };
};

export type CnesSnapshot = {
  meta: CnesSnapshotMeta;
  establishments: CnesEstablishment[];
  teams: CnesTeam[];
};

export type CnesSyncSource = 'live' | 'snapshot' | 'auto';

export type CnesSyncResult = {
  ibgeCode: string;
  source: 'live' | 'snapshot';
  facilities: { created: number; updated: number; skipped: number };
  teams: { created: number; updated: number; skipped: number };
  totals: { establishments: number; teams: number; establishmentsActive: number };
  snapshotPath?: string;
};

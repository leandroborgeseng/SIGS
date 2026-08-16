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
  /** tipo_gestao CNES: M municipal / E estadual / D dupla / F federal */
  tipoGestao?: string | null;
  /** descricao_esfera_administrativa */
  esferaAdministrativa?: string | null;
  /** Código natureza jurídica (ex.: 1244 = Município) */
  naturezaJuridica?: string | null;
  razaoSocial?: string | null;
  /** true = rede Prefeitura (critério natureza 1244) */
  municipalNetwork?: boolean;
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
  competenciaHint?: string;
  gestaoFilter?: string;
  gestaoCriterion?: string;
  counts?: {
    establishments?: number;
    teams?: number;
    establishmentsActive?: number;
    establishmentsCity?: number;
    teamsCity?: number;
    establishmentsMunicipal?: number;
    teamsMunicipal?: number;
    establishmentsMunicipalActive?: number;
  };
};

export type CnesSnapshot = {
  meta: CnesSnapshotMeta;
  establishments: CnesEstablishment[];
  teams: CnesTeam[];
};

export type CnesSyncSource = 'live' | 'snapshot' | 'auto';

/** Default: só rede municipal (Prefeitura). `todos` = cidade inteira. */
export type CnesSyncGestao = 'municipal' | 'todos';

export type CnesSyncFilterInfo = {
  mode: CnesSyncGestao;
  criterion: string;
  before: { establishments: number; teams: number; establishmentsActive: number };
  after: { establishments: number; teams: number; establishmentsActive: number };
};

export type CnesSyncResult = {
  ibgeCode: string;
  source: 'live' | 'snapshot';
  gestao: CnesSyncGestao;
  filter: CnesSyncFilterInfo;
  facilities: { created: number; updated: number; skipped: number };
  teams: { created: number; updated: number; skipped: number };
  totals: {
    establishments: number;
    teams: number;
    establishmentsActive: number;
    establishmentsCity?: number;
    teamsCity?: number;
  };
  snapshotPath?: string;
};

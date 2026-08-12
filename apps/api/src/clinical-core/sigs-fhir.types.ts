/**
 * Recursos internos FHIR-like (orientação R4).
 * Não é Bundle RNDS — é o domínio canônico do SIGS.
 */

export type SigsResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Practitioner'
  | 'Organization'
  | 'Procedure'
  | 'Condition'
  | 'Composition';

export type SigsIdentifier = {
  system: string;
  value: string;
  use?: 'official' | 'secondary' | 'temp' | 'old';
};

export type SigsPatient = {
  resourceType: 'Patient';
  id?: string;
  identifiers: SigsIdentifier[];
  civilName?: string;
  socialName?: string;
  birthDate?: string; // YYYY-MM-DD
  sex?: 'male' | 'female' | 'other' | 'unknown';
  motherName?: string;
};

export type SigsProcedure = {
  resourceType: 'Procedure';
  code: string; // SIGTAP
  quantity?: number;
};

export type SigsCondition = {
  resourceType: 'Condition';
  ciap?: string;
  cid10?: string;
};

export type SigsEncounter = {
  resourceType: 'Encounter';
  id?: string;
  /** FAO | FAI | PROCEDIMENTOS | … */
  fichaTipo?: string;
  uuidFicha?: string;
  status: 'planned' | 'in-progress' | 'finished' | 'unknown';
  periodStart?: string; // ISO
  periodEnd?: string;
  patient?: SigsPatient;
  practitionerCns?: string;
  cbo?: string;
  cnes?: string;
  ine?: string;
  ibgeMunicipio?: string;
  localAtendimento?: number;
  turno?: number;
  tipoAtendimento?: number;
  gestante?: boolean;
  stNaoPossuiCpf?: boolean;
  justificativaNaoPossuiCpf?: number;
  procedures: SigsProcedure[];
  conditions: SigsCondition[];
  /** Códigos LEDI brutos úteis ao RulePack */
  extensions?: Record<string, unknown>;
};

export type SigsComposition = {
  resourceType: 'Composition';
  id?: string;
  title: string;
  fichaTipo: string;
  fichaTipoCode?: number | null;
  uuidFicha?: string;
  encounters: SigsEncounter[];
  /** XML/source residual para export LEDI até o exporter puro existir */
  sourceFormat: 'ledi-xml' | 'sigs-native' | 'unknown';
  sourceXml?: string;
};

export type SigsBundle = {
  resourceType: 'Bundle';
  type: 'collection' | 'document';
  entries: Array<SigsComposition | SigsPatient | SigsEncounter>;
};

export type FindingSeverity = 'BLOCKER' | 'MONEY_RISK' | 'QUALITY_WARN' | 'INFO';

export type RulesFinding = {
  code: string;
  severity: FindingSeverity;
  message: string;
  path?: string;
};

export type RulesEngineResult = {
  findings: RulesFinding[];
  composition: SigsComposition;
  indicators?: Record<string, unknown>;
  repaired: boolean;
  audit: Array<{ action: string; detail: Record<string, unknown> }>;
};

/**
 * Rascunho clínico/LEDI do atendimento odonto (careJson).
 * Campos alinhados ao validador FAO + RF-12 Onda 1.
 * Extensões clínicas (tratamento, faces, encaminhamento MVP) ficam no careJson
 * sem inventar campos no Thrift FAO oficial.
 */

import { isValidFdiTooth } from './dental-odontogram';

/** Ciclo de tratamento (RF-12.4 / RF-12.7) — distinto de concluir a consulta (finish FAO). */
export type DentalTreatmentCycle = {
  id: string;
  /** Nº interno opcional (exibição clínica) */
  number?: string | null;
  startedAt: string;
  endedAt?: string | null;
  /** OPEN = em curso · FINALIZED = tratamento encerrado · INTERRUPTED = stub (menu próprio depois) */
  status: 'OPEN' | 'FINALIZED' | 'INTERRUPTED';
};

/** Encaminhamento clínico MVP (sem reservas de agenda de especialidade). */
export type DentalReferralDraft = {
  id: string;
  specialty: string;
  justification: string;
  createdAt: string;
};

/**
 * Faces do dente (cruz clínica) — só careJson; Thrift FAO não serializa superfície.
 * Chaves: M mesial · D distal · V vestibular · L lingual/palatina · O oclusal.
 */
export type DentalOdontogramFaces = Record<string, Partial<Record<string, string>>>;

export type DentalCareDraft = {
  tipoAtendimento: number;
  /** Condicional: obrigatório se tipo=2 */
  tiposConsultaOdonto: number[];
  /** LEDI local 1–10 (default 1 UBS) */
  localAtendimento: number;
  /** 1 manhã · 2 tarde · 3 noite */
  turno: number;
  gestante: boolean;
  necessidadesEspeciais: boolean;
  /** Códigos string do catálogo (ALTA, TRATAMENTO_CONCLUIDO…) ou ids numéricos como string */
  outcomes: string[];
  vigilanciaSaudeBucal: number[];
  /** ESCOVA | CREME | FIO ou ids */
  fornecimentos: string[];
  problemasCondicoes: Array<{ ciap?: string; cid10?: string }>;
  stNaoPossuiCpf: boolean;
  justificativaNaoPossuiCpf?: number | null;
  /** ISO opcional — senão usa startedAt/finishedAt do encounter */
  dataHoraInicialAtendimento?: string | null;
  dataHoraFinalAtendimento?: string | null;
  assignmentId?: string | null;
  cbo?: string | null;
  /** Antecedentes clínicos (texto; RF-12.9 adjacente à anamnese) */
  antecedentes?: string;
  /** Observações gerais do atendimento */
  observacoes?: string;
  /** Planejamento do tratamento (texto livre no odontograma) */
  planejamentoTratamento?: string;
  /** Notas de tratamento realizado (além dos procs SIGTAP `done`) */
  tratamentoRealizadoNotas?: string;
  /** Observações por dente FDI */
  toothNotes?: Record<string, string>;
  /** Marcadores de face por dente (não vão ao XML Thrift) */
  odontogramFaces?: DentalOdontogramFaces;
  /** Ciclo de tratamento vigente (opcional) */
  treatment?: DentalTreatmentCycle | null;
  /** Encaminhamentos clínicos registrados neste atendimento */
  referrals?: DentalReferralDraft[];
};

const TREATMENT_STATUSES = new Set(['OPEN', 'FINALIZED', 'INTERRUPTED']);

function coerceTreatment(
  raw: DentalTreatmentCycle | null | undefined,
): DentalTreatmentCycle | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;
  const status = String(raw.status || 'OPEN').toUpperCase();
  if (!TREATMENT_STATUSES.has(status)) return null;
  const startedAt = String(raw.startedAt || '').trim();
  if (!startedAt) return null;
  return {
    id,
    number: raw.number != null ? String(raw.number) : null,
    startedAt,
    endedAt: raw.endedAt != null ? String(raw.endedAt) : null,
    status: status as DentalTreatmentCycle['status'],
  };
}

function coerceReferrals(raw: unknown): DentalReferralDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: DentalReferralDraft[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as DentalReferralDraft;
    const id = String(r.id || '').trim();
    const specialty = String(r.specialty || '').trim();
    const justification = String(r.justification || '').trim();
    const createdAt = String(r.createdAt || '').trim();
    if (!id || !specialty) continue;
    out.push({ id, specialty, justification, createdAt: createdAt || new Date().toISOString() });
  }
  return out;
}

function coerceToothNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const tooth = String(k).trim();
    const note = String(v ?? '').trim();
    if (isValidFdiTooth(tooth) && note) out[tooth] = note;
  }
  return out;
}

function coerceFaces(raw: unknown): DentalOdontogramFaces {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: DentalOdontogramFaces = {};
  for (const [tooth, faces] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidFdiTooth(tooth) || !faces || typeof faces !== 'object' || Array.isArray(faces)) {
      continue;
    }
    const faceMap: Partial<Record<string, string>> = {};
    for (const [face, code] of Object.entries(faces as Record<string, unknown>)) {
      const f = String(face).trim().toUpperCase();
      const c = String(code ?? '').trim().toUpperCase();
      if (!f || !c) continue;
      faceMap[f] = c;
    }
    if (Object.keys(faceMap).length) out[tooth] = faceMap;
  }
  return out;
}

export function defaultDentalCareDraft(partial?: Partial<DentalCareDraft>): DentalCareDraft {
  const tipo = Number(process.env.DENTAL_DEFAULT_TIPO_ATENDIMENTO || 5);
  const base: DentalCareDraft = {
    tipoAtendimento: [2, 4, 5, 6].includes(tipo) ? tipo : 5,
    tiposConsultaOdonto: [],
    localAtendimento: Number(process.env.DENTAL_DEFAULT_LOCAL || 1),
    turno: Number(process.env.DENTAL_DEFAULT_TURNO || 2),
    gestante: false,
    necessidadesEspeciais: false,
    outcomes: [],
    vigilanciaSaudeBucal: [],
    fornecimentos: [],
    problemasCondicoes: [],
    stNaoPossuiCpf: false,
    justificativaNaoPossuiCpf: null,
    dataHoraInicialAtendimento: null,
    dataHoraFinalAtendimento: null,
    assignmentId: null,
    cbo: null,
    antecedentes: '',
    observacoes: '',
    planejamentoTratamento: '',
    tratamentoRealizadoNotas: '',
    toothNotes: {},
    odontogramFaces: {},
    treatment: null,
    referrals: [],
  };
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    toothNotes: coerceToothNotes(partial.toothNotes ?? base.toothNotes),
    odontogramFaces: coerceFaces(partial.odontogramFaces ?? base.odontogramFaces),
    treatment:
      partial.treatment === undefined
        ? base.treatment
        : coerceTreatment(partial.treatment),
    referrals: coerceReferrals(partial.referrals ?? base.referrals),
    antecedentes: partial.antecedentes != null ? String(partial.antecedentes) : base.antecedentes,
    observacoes: partial.observacoes != null ? String(partial.observacoes) : base.observacoes,
    planejamentoTratamento:
      partial.planejamentoTratamento != null
        ? String(partial.planejamentoTratamento)
        : base.planejamentoTratamento,
    tratamentoRealizadoNotas:
      partial.tratamentoRealizadoNotas != null
        ? String(partial.tratamentoRealizadoNotas)
        : base.tratamentoRealizadoNotas,
  };
}

/** Especialidades de encaminhamento odonto (MVP — lista fechada SIGS, não e-SUS). */
export const DENTAL_REFERRAL_SPECIALTIES = [
  { id: 'ENDODONTIA', label: 'Endodontia' },
  { id: 'PERIODONTIA', label: 'Periodontia' },
  { id: 'CIRURGIA_BMF', label: 'Cirurgia BMF' },
  { id: 'PROTESE', label: 'Prótese' },
  { id: 'ORTODONTIA', label: 'Ortodontia' },
  { id: 'ODONTOPEDIATRIA', label: 'Odontopediatria' },
  { id: 'ESTOMATOLOGIA', label: 'Estomatologia' },
  { id: 'RADIOLOGIA', label: 'Radiologia' },
  { id: 'OUTROS', label: 'Outros' },
] as const;

/** Franca default true; outras cidades: REQUIRE_INE_DENTAL_OPEN=false */
export function requireIneOnDentalOpen(): boolean {
  return process.env.REQUIRE_INE_DENTAL_OPEN !== 'false';
}

export function dentalMunicipioIbgeFallback(): string {
  return process.env.MUNICIPIO_IBGE || '3516200';
}

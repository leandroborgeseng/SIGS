import type { FaoFinding } from './ledi-fao.validator';
import type { DentalCareDraft } from './dental-care.draft';

export type BillingSeverityBucket = 'blocker' | 'money' | 'quality' | 'ok' | 'incomplete';

export function bucketFromFindings(findings: FaoFinding[], encounterOpen: boolean): BillingSeverityBucket {
  if (findings.some((f) => f.severity === 'BLOCKER')) return 'blocker';
  if (findings.some((f) => f.severity === 'MONEY_RISK')) return 'money';
  if (findings.some((f) => f.severity === 'QUALITY_WARN')) return 'quality';
  if (encounterOpen) return 'incomplete';
  return 'ok';
}

export function bucketSeverityClass(bucket: BillingSeverityBucket): string {
  if (bucket === 'blocker') return 'BLOCKER';
  if (bucket === 'money') return 'MONEY_RISK';
  if (bucket === 'quality') return 'QUALITY_WARN';
  if (bucket === 'ok') return 'ok';
  return 'INFO';
}

/** Lacunas clínicas óbvias antes mesmo do validador FAO (fechamento do mês). */
export function dentalMissingChecklist(input: {
  care: DentalCareDraft;
  patient: { cpf?: string | null; cns?: string | null; birthDate?: Date | null; sex?: string | null };
  hasIne: boolean;
  requireIne: boolean;
  proceduresCount: number;
}): Array<{ code: string; severity: 'BLOCKER' | 'MONEY_RISK' | 'QUALITY_WARN'; message: string }> {
  const out: Array<{
    code: string;
    severity: 'BLOCKER' | 'MONEY_RISK' | 'QUALITY_WARN';
    message: string;
  }> = [];
  const { care, patient } = input;

  if (!patient.cpf && !patient.cns && !care.stNaoPossuiCpf) {
    out.push({
      code: 'PATIENT_ID_MISSING',
      severity: 'BLOCKER',
      message: 'Paciente sem CPF/CNS e sem stNaoPossuiCpf.',
    });
  }
  if (care.stNaoPossuiCpf && care.justificativaNaoPossuiCpf == null) {
    out.push({
      code: 'JUSTIFICATIVA_CPF_MISSING',
      severity: 'BLOCKER',
      message: 'Informe justificativa de não possuir CPF.',
    });
  }
  if (!patient.birthDate) {
    out.push({
      code: 'DT_NASCIMENTO_MISSING',
      severity: 'BLOCKER',
      message: 'Data de nascimento ausente no cadastro.',
    });
  }
  if (!patient.sex) {
    out.push({
      code: 'SEXO_MISSING',
      severity: 'BLOCKER',
      message: 'Sexo ausente no cadastro.',
    });
  }
  if (!care.outcomes?.length) {
    out.push({
      code: 'CONDUTA_MISSING',
      severity: 'BLOCKER',
      message: 'Nenhuma conduta/desfecho selecionada.',
    });
  }
  if (!care.vigilanciaSaudeBucal?.length) {
    out.push({
      code: 'VIGILANCIA_MISSING',
      severity: 'BLOCKER',
      message: 'Vigilância em saúde bucal não preenchida.',
    });
  }
  if (!care.problemasCondicoes?.some((p) => p.ciap || p.cid10)) {
    out.push({
      code: 'PROBLEMAS_MISSING',
      severity: 'BLOCKER',
      message: 'Informe ao menos um CIAP ou CID-10.',
    });
  }
  if (care.tipoAtendimento === 2 && !care.tiposConsultaOdonto?.length) {
    out.push({
      code: 'TIPO_CONSULTA_REQUIRED',
      severity: 'BLOCKER',
      message: 'Tipo de consulta odonto obrigatório quando tipoAtendimento=2.',
    });
  }
  if (input.requireIne && !input.hasIne) {
    out.push({
      code: 'INE_MISSING',
      severity: 'QUALITY_WARN',
      message: 'INE da equipe não informado (obrigatório nesta instalação).',
    });
  }
  if (!input.proceduresCount) {
    out.push({
      code: 'PROC_RECOMMENDED',
      severity: 'MONEY_RISK',
      message: 'Nenhum procedimento SIGTAP registrado (recomendado para produção).',
    });
  }
  return out;
}

export function competenciaFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function competenciaRange(competencia: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia.trim());
  if (!m) {
    const now = new Date();
    return competenciaRange(competenciaFromDate(now));
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}

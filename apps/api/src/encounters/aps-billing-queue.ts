import type { FaoFinding } from '../care-extra/ledi-fao.validator';
import type { ApsCareDraft } from './aps-care.draft';

export const APS_FATURAMENTO_QUEUE_LIMIT = 500;

/** Lacunas clínicas óbvias antes do validador FAI (fila do mês). */
export function apsMissingChecklist(input: {
  care: ApsCareDraft;
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
      message: 'Nenhuma conduta/encaminhamento FAI selecionada.',
    });
  }
  if (!care.problemasCondicoes?.some((p) => p.ciap || p.cid10)) {
    out.push({
      code: 'PROBLEMAS_MISSING',
      severity: 'BLOCKER',
      message: 'Informe ao menos um CIAP ou CID-10.',
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

export function findingsFromMissing(
  missing: ReturnType<typeof apsMissingChecklist>,
): FaoFinding[] {
  return missing.map((m) => ({
    severity: m.severity,
    code: m.code,
    message: m.message,
    rule: 'QUEUE-checklist',
  }));
}

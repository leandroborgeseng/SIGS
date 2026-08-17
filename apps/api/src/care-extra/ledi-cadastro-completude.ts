/**
 * Completude cadastro individual (tipo 2 / Paciente Mestre).
 * Campos alinhados a FieldHint Siaps×Previne + checklist cruzamentos-fichas-ledi §3
 * — não inventa norma além do já documentado/validado no PatientsService.
 */

import type { FaoFinding, FaoSeverity } from './ledi-fao.validator';

export const CODE_CADASTRO_INCOMPLETO_SIAPS = 'CADASTRO_INCOMPLETO_SIAPS';
export const CODE_CADASTRO_INCOMPLETO_PREVINE = 'CADASTRO_INCOMPLETO_PREVINE';

export type CadastroPatientSnap = {
  id: string;
  civilName: string;
  birthDate: Date | string | null;
  sex: string | null;
  motherName: string | null;
  motherNameUnknown: boolean;
  cpf: string | null;
  cns: string | null;
  nationality: string | null;
  birthMunicipalityIbge: string | null;
  raceColor: string | null;
  ethnicity: string | null;
  /** true se há patient-team-link ativo */
  hasActiveTeamLink: boolean;
  active?: boolean;
};

export type CompletudeResult = {
  siapsMissing: string[];
  previneMissing: string[];
};

function dig(v: string | null | undefined): string {
  return String(v || '').replace(/\D/g, '');
}

function isIndigenaRace(race: string): boolean {
  const r = race
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return r.includes('INDIGEN') || r === '5' || r === 'INDIGENA';
}

/**
 * Avalia gaps Siaps (ID mínimo) e Previne (CDS RF-2.30 + vínculo NT 30).
 * NIS/escolaridade/e-mail: completude local — não bloqueiam aqui (FieldHint “se informado”).
 */
export function evaluateCadastroCompletude(p: CadastroPatientSnap): CompletudeResult {
  const siapsMissing: string[] = [];
  const previneMissing: string[] = [];

  if (!String(p.civilName || '').trim()) siapsMissing.push('civilName');
  if (!p.birthDate) siapsMissing.push('birthDate');
  if (!String(p.sex || '').trim()) siapsMissing.push('sex');
  if (!p.motherNameUnknown && !String(p.motherName || '').trim()) {
    siapsMissing.push('motherName|motherNameUnknown');
  }
  const cpf = dig(p.cpf);
  const cns = dig(p.cns);
  if (cpf.length !== 11 && cns.length !== 15) siapsMissing.push('cpf|cns');

  const nat = String(p.nationality || '').trim().toUpperCase();
  if (!nat) {
    previneMissing.push('nationality');
  } else if (nat === 'BRASILEIRA') {
    const ibge = String(p.birthMunicipalityIbge || '').trim();
    if (!ibge || !/^\d{6,7}$/.test(ibge)) previneMissing.push('birthMunicipalityIbge');
  }

  const race = String(p.raceColor || '').trim();
  if (!race) {
    previneMissing.push('raceColor');
  } else if (isIndigenaRace(race) && !String(p.ethnicity || '').trim()) {
    previneMissing.push('ethnicity');
  }

  if (!p.hasActiveTeamLink) previneMissing.push('patientTeamLink');

  return { siapsMissing, previneMissing };
}

function push(
  findings: FaoFinding[],
  severity: FaoSeverity,
  code: string,
  message: string,
  extra?: Partial<FaoFinding>,
) {
  findings.push({ severity, code, message, rule: extra?.rule || 'tipo2-completude', ...extra });
}

/** Emite findings de completude (no máximo um Siaps + um Previne por paciente). */
export function appendCadastroCompletudeFindings(
  findings: FaoFinding[],
  patient: CadastroPatientSnap,
) {
  if (patient.active === false) return;
  const { siapsMissing, previneMissing } = evaluateCadastroCompletude(patient);

  if (siapsMissing.length) {
    push(
      findings,
      'BLOCKER',
      CODE_CADASTRO_INCOMPLETO_SIAPS,
      `Cadastro ${patient.id.slice(0, 8)} incompleto para Siaps (ID mínimo): ${siapsMissing.join(', ')}.`,
      {
        field: siapsMissing[0],
        hint: 'Complete nome, DN, sexo, mãe (ou Desconhece) e CPF ou CNS em /pacientes.',
        rule: 'tipo2-completude-siaps',
      },
    );
  }

  if (previneMissing.length) {
    push(
      findings,
      'MONEY_RISK',
      CODE_CADASTRO_INCOMPLETO_PREVINE,
      `Cadastro ${patient.id.slice(0, 8)} incompleto para Previne/CDS: ${previneMissing.join(', ')}.`,
      {
        field: previneMissing[0],
        hint: 'Complete nacionalidade/raça (+ IBGE se BR) e vínculo equipe em /pacientes e /territorio.',
        rule: 'tipo2-completude-previne',
      },
    );
  }
}

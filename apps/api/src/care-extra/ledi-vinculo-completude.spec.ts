import {
  appendVinculoNt30CrossChecks,
  isCidadaoKnownInMaster,
  resolveVinculoRef,
  vinculoCoverageNote,
  CODE_PRODUCAO_INE_NEQ,
  CODE_PRODUCAO_SEM_VINCULO,
  type LediVinculoNt30Ctx,
} from './ledi-vinculo-nt30';
import {
  appendCadastroCompletudeFindings,
  evaluateCadastroCompletude,
  CODE_CADASTRO_INCOMPLETO_PREVINE,
  CODE_CADASTRO_INCOMPLETO_SIAPS,
  type CadastroPatientSnap,
} from './ledi-cadastro-completude';
import type { FaoFinding } from './ledi-fao.validator';

describe('ledi-vinculo-nt30', () => {
  const ctx: LediVinculoNt30Ctx = {
    byPatientId: new Map([
      ['p1', { patientId: 'p1', ines: ['0001667653'] }],
      ['p2', { patientId: 'p2', ines: [] }],
    ]),
    byCns: new Map([
      ['898001111111111', { patientId: 'p1', ines: ['0001667653'] }],
      ['898002222222222', { patientId: 'p2', ines: [] }],
    ]),
    byCpf: new Map(),
    knownPatientIds: new Set(['p1', 'p2', 'p3']),
    knownCns: new Set(['898001111111111', '898002222222222', '898003333333333']),
    knownCpf: new Set(),
    stats: { activeLinks: 1, patientsWithActiveLink: 1, patientsIndexed: 3 },
  };

  it('emite PRODUCAO_SEM_VINCULO_EQUIPE quando conhecido sem link', () => {
    const findings: FaoFinding[] = [];
    appendVinculoNt30CrossChecks(
      findings,
      { cns: '898002222222222', headerIne: '0001667653' },
      ctx,
    );
    expect(findings.some((f) => f.code === CODE_PRODUCAO_SEM_VINCULO)).toBe(true);
  });

  it('emite PRODUCAO_INE_NEQ_VINCULO quando INE diverge', () => {
    const findings: FaoFinding[] = [];
    appendVinculoNt30CrossChecks(
      findings,
      { cns: '898001111111111', headerIne: '9999999999' },
      ctx,
    );
    expect(findings.some((f) => f.code === CODE_PRODUCAO_INE_NEQ)).toBe(true);
  });

  it('não emite quando INE do header bate com vínculo', () => {
    const findings: FaoFinding[] = [];
    appendVinculoNt30CrossChecks(
      findings,
      { cns: '898001111111111', headerIne: '0001667653' },
      ctx,
    );
    expect(findings).toHaveLength(0);
  });

  it('não emite se cidadão fora do mestre', () => {
    const findings: FaoFinding[] = [];
    appendVinculoNt30CrossChecks(
      findings,
      { cns: '898009999999999', headerIne: '0001667653' },
      ctx,
    );
    expect(findings).toHaveLength(0);
    expect(isCidadaoKnownInMaster({ cns: '898009999999999' }, ctx)).toBe(false);
  });

  it('resolve ref e cobertura fraca', () => {
    expect(resolveVinculoRef({ patientId: 'p1' }, ctx)?.ines).toEqual(['0001667653']);
    expect(
      vinculoCoverageNote({ activeLinks: 0, patientsWithActiveLink: 0, patientsIndexed: 10 }),
    ).toMatch(/Nenhum patient-team-link/);
  });
});

describe('ledi-cadastro-completude', () => {
  const base: CadastroPatientSnap = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    civilName: 'Maria',
    birthDate: new Date('1990-01-01'),
    sex: 'F',
    motherName: 'Ana',
    motherNameUnknown: false,
    cpf: '12345678901',
    cns: null,
    nationality: 'BRASILEIRA',
    birthMunicipalityIbge: '3516200',
    raceColor: 'PARDA',
    ethnicity: null,
    hasActiveTeamLink: true,
  };

  it('Siaps completo + Previne completo → sem gaps', () => {
    const r = evaluateCadastroCompletude(base);
    expect(r.siapsMissing).toEqual([]);
    expect(r.previneMissing).toEqual([]);
  });

  it('marca CADASTRO_INCOMPLETO_SIAPS sem CPF/CNS', () => {
    const findings: FaoFinding[] = [];
    appendCadastroCompletudeFindings(findings, { ...base, cpf: null, cns: null });
    expect(findings.some((f) => f.code === CODE_CADASTRO_INCOMPLETO_SIAPS)).toBe(true);
  });

  it('marca CADASTRO_INCOMPLETO_PREVINE sem nacionalidade/vínculo', () => {
    const findings: FaoFinding[] = [];
    appendCadastroCompletudeFindings(findings, {
      ...base,
      nationality: null,
      hasActiveTeamLink: false,
    });
    expect(findings.some((f) => f.code === CODE_CADASTRO_INCOMPLETO_PREVINE)).toBe(true);
    const msg = findings.find((f) => f.code === CODE_CADASTRO_INCOMPLETO_PREVINE)?.message || '';
    expect(msg).toMatch(/nationality/);
    expect(msg).toMatch(/patientTeamLink/);
  });

  it('exige IBGE se BRASILEIRA e ethnicity se indígena', () => {
    expect(
      evaluateCadastroCompletude({
        ...base,
        birthMunicipalityIbge: null,
      }).previneMissing,
    ).toContain('birthMunicipalityIbge');
    expect(
      evaluateCadastroCompletude({
        ...base,
        raceColor: 'INDIGENA',
        ethnicity: null,
      }).previneMissing,
    ).toContain('ethnicity');
  });
});

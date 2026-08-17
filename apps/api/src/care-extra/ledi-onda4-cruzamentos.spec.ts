import {
  appendCadastroSemDomicilio,
  appendVisitaHouseholdFindings,
  CODE_CADASTRO_SEM_DOMICILIO,
  CODE_VISITA_HOUSEHOLD_NOT_FOUND,
} from './ledi-territorio-cruzamentos';
import {
  appendColetivoB4FaixaChecks,
  CODE_COLETIVO_B4_SEM_FAIXA,
  hasB4Escovacao,
} from './ledi-coletivo-b4';
import {
  appendCidadaoMasterCrossChecksMany,
  extractAllCidadaoIdsFromXml,
  findingCodeForTipo,
} from './ledi-cidadao-master';
import type { FaoFinding } from './ledi-fao.validator';

describe('onda 4 cruzamentos P2', () => {
  it('extrai N CNS de AD multi-child no XML', () => {
    const xml = `
      <atendimentosDomiciliares><cnsCidadao>898001111111111</cnsCidadao></atendimentosDomiciliares>
      <atendimentosDomiciliares><cnsCidadao>898002222222222</cnsCidadao><cpfCidadao>52998224725</cpfCidadao></atendimentosDomiciliares>
    `;
    const list = extractAllCidadaoIdsFromXml(xml);
    expect(list).toHaveLength(2);
    expect(list[0].cns).toBe('898001111111111');
    expect(list[1].cpf).toBe('52998224725');
  });

  it('AD multi: emite finding por cidadão fora do mestre', () => {
    const findings: FaoFinding[] = [];
    appendCidadaoMasterCrossChecksMany(
      findings,
      [
        { cns: '898001111111111', cpf: '' },
        { cns: '898009999999999', cpf: '' },
      ],
      'AD',
      { knownCns: new Set(['898001111111111']), knownCpf: new Set() },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('AD_CNS_NOT_IN_CADASTRO_INDIVIDUAL');
  });

  it('mapeia coletivo para COLETIVO_PARTICIPANTE_NOT_IN_CADASTRO', () => {
    expect(findingCodeForTipo('COLETIVO')).toBe('COLETIVO_PARTICIPANTE_NOT_IN_CADASTRO');
    expect(findingCodeForTipo('VISITA_ACS')).toBe('VISITA_CNS_NOT_IN_CADASTRO_INDIVIDUAL');
  });

  it('B4: não emite sem participantes com idade', () => {
    expect(hasB4Escovacao(['0101020031'])).toBe(true);
    const findings: FaoFinding[] = [];
    appendColetivoB4FaixaChecks(findings, {
      procedureCodes: ['0101020031'],
      participants: [{ cns: '898001111111111', cpf: '' }],
      master: { knownCns: new Set(['898001111111111']), knownCpf: new Set() },
    });
    expect(findings).toHaveLength(0);
  });

  it('B4: emite quando idade fora de 6–12', () => {
    const findings: FaoFinding[] = [];
    const birth = new Date(Date.UTC(2000, 0, 15)); // ~26 anos em 2026
    appendColetivoB4FaixaChecks(findings, {
      procedureCodes: ['0101050011'],
      participants: [{ cns: '898001111111111', cpf: '' }],
      referenceDate: new Date(Date.UTC(2026, 7, 17)),
      master: {
        knownCns: new Set(['898001111111111']),
        knownCpf: new Set(),
        birthDateByCns: new Map([['898001111111111', birth]]),
      },
    });
    expect(findings.some((f) => f.code === CODE_COLETIVO_B4_SEM_FAIXA)).toBe(true);
  });

  it('B4: idade 8 anos ok', () => {
    const findings: FaoFinding[] = [];
    appendColetivoB4FaixaChecks(findings, {
      procedureCodes: ['0101020031'],
      participants: [{ cns: '898001111111111', cpf: '', ageYears: 8 }],
    });
    expect(findings).toHaveLength(0);
  });

  it('CADASTRO_SEM_DOMICILIO só com households presentes', () => {
    const empty: FaoFinding[] = [];
    appendCadastroSemDomicilio(empty, 'p1', {
      patientIdsWithHousehold: new Set(),
      activeHouseholdIds: new Set(),
      householdsPresent: false,
    });
    expect(empty).toHaveLength(0);

    const findings: FaoFinding[] = [];
    appendCadastroSemDomicilio(findings, 'p1', {
      patientIdsWithHousehold: new Set(['p2']),
      activeHouseholdIds: new Set(['h1']),
      householdsPresent: true,
    });
    expect(findings[0].code).toBe(CODE_CADASTRO_SEM_DOMICILIO);
  });

  it('VISITA_HOUSEHOLD_NOT_FOUND quando household inválido', () => {
    const findings: FaoFinding[] = [];
    appendVisitaHouseholdFindings(
      findings,
      { householdId: 'ghost', patientId: 'p1' },
      {
        patientIdsWithHousehold: new Set(['p1']),
        activeHouseholdIds: new Set(['h1']),
        householdsPresent: true,
      },
    );
    expect(findings[0].code).toBe(CODE_VISITA_HOUSEHOLD_NOT_FOUND);
  });
});

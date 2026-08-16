import {
  syncCatalog,
  validateAgeForApplications,
  validateVaccineApplications,
} from './catalog';
import { buildVaccinationLediPayload } from './ledi-vaccination.mapper';

describe('vaccination rules', () => {
  it('exige CBO e CID na Estratégia Especial', () => {
    const errors = validateVaccineApplications([
      {
        immunobiologicalId: 'HB',
        strategyId: 'SPECIAL',
        doseId: 'D1',
        attendanceGroupId: 'GERAL',
        lot: 'L123',
        manufacturer: 'Butantan',
        routeId: 'IM',
        siteId: 'LD',
      },
    ]);
    expect(errors.some((e) => e.includes('prescriberCbo'))).toBe(true);
    expect(errors.some((e) => e.includes('indicationCid10'))).toBe(true);
  });

  it('exige leprosyContact para BCG', () => {
    const errors = validateVaccineApplications([
      {
        immunobiologicalId: 'BCG',
        strategyId: 'ROUTINE',
        doseId: 'DU',
        attendanceGroupId: 'GERAL',
        lot: 'B1',
        manufacturer: 'Bio',
        routeId: 'ID',
        siteId: 'RD',
      },
    ]);
    expect(errors.some((e) => e.includes('leprosyContact'))).toBe(true);
  });

  it('aceita BCG com leprosyContact informado', () => {
    const errors = validateVaccineApplications([
      {
        immunobiologicalId: 'BCG',
        strategyId: 'ROUTINE',
        doseId: 'DU',
        attendanceGroupId: 'GERAL',
        lot: 'B1',
        manufacturer: 'Bio',
        routeId: 'ID',
        siteId: 'RD',
        leprosyContact: false,
      },
    ]);
    expect(errors).toEqual([]);
  });
});

describe('buildVaccinationLediPayload', () => {
  it('monta ficha com vacinas[] e lotação', () => {
    const payload = buildVaccinationLediPayload({
      uuidFicha: 'v-1',
      lotacao: {
        profissionalCNS: '898000000000000',
        cboCodigo_2002: '223505',
        cnes: '1234567',
        ine: '0000000001',
      },
      appliedAt: new Date('2026-08-10T15:00:00Z'),
      shift: 'AFTERNOON',
      careLocation: 'UBS',
      patient: {
        cpf: '12345678901',
        cns: null,
        birthDate: new Date('2024-01-01'),
        sex: 'MALE',
      },
      applications: [
        {
          immunobiologicalId: 'BCG',
          strategyId: 'ROUTINE',
          doseId: 'DU',
          attendanceGroupId: 'GERAL',
          lot: 'B1',
          manufacturer: 'Bio',
          routeId: 'ID',
          siteId: 'RD',
          leprosyContact: true,
        },
      ],
    });
    expect(payload.mapperVersion).toBe('ledi-vaccination-v2');
    expect(payload.headerTransport.cboCodigo_2002).toBe('223505');
    expect(payload.vacinacoesIndividuais[0].turno).toBe(2);
    expect(payload.vacinacoesIndividuais[0].sexo).toBe(0);
    expect(payload.vacinacoesIndividuais[0].vacinas).toHaveLength(1);
    expect(payload.vacinacoesIndividuais[0].vacinas[0].comunicanteHanseniase).toBe(true);
    expect(payload.vacinacoesIndividuais[0].vacinas[0].imunobiologico).toBe(15);
    expect(payload.vacinacoesIndividuais[0].vacinas[0].estrategiaVacinacao).toBe(1);
    expect(payload.vacinacoesIndividuais[0].vacinas[0].dose).toBe(9);
    expect(payload.vacinacoesIndividuais[0].vacinas[0].viaAdministracao).toBe(4);
    expect(payload.vacinacoesIndividuais[0].vacinas[0].imunobiologicoCode).toBe('BCG');
  });
});

describe('catalog LEDI ids', () => {
  it('BCG=15 e estratégias alinhadas ao DbEnum', () => {
    const { getImmunobiologicals, STRATEGIES, resolveImmunoLediId, resolveStrategyLediId, IMMUNOBIOLOGICALS_SEED } =
      require('./catalog');
    expect(resolveImmunoLediId('BCG')).toBe(15);
    expect(resolveImmunoLediId('HB')).toBe(9);
    expect(resolveImmunoLediId('PENTA')).toBe(42);
    expect(resolveImmunoLediId('ROTA')).toBe(45);
    expect(resolveImmunoLediId('HPV4')).toBe(67);
    expect(resolveImmunoLediId('DT_INF')).toBe(5);
    expect(resolveImmunoLediId('DT')).toBe(25);
    expect(resolveStrategyLediId('ROUTINE')).toBe(1);
    expect(resolveStrategyLediId('SPECIAL')).toBe(2);
    expect(IMMUNOBIOLOGICALS_SEED.length).toBe(99);
    expect(getImmunobiologicals().length).toBeGreaterThanOrEqual(99);
    expect(STRATEGIES.length).toBe(15);
  });

  it('sync overlay adiciona imunobiológico sem perder seed', () => {
    syncCatalog({ reset: true });
    const before = require('./catalog').getImmunobiologicals().length;
    syncCatalog({
      immunobiologicals: [{ id: 'CUSTOM_X', label: 'Custom municipal', lediId: 999 }],
    });
    const { getImmunobiologicals, resolveImmunoLediId } = require('./catalog');
    expect(resolveImmunoLediId('CUSTOM_X')).toBe(999);
    expect(getImmunobiologicals().length).toBe(before + 1);
    syncCatalog({ reset: true });
  });
});

describe('faixa etária RF-14.7/14.8', () => {
  const baseApp = {
    immunobiologicalId: 'ROTA',
    strategyId: 'ROUTINE',
    doseId: 'D1',
    attendanceGroupId: 'GERAL',
    lot: 'R1',
    manufacturer: 'Bio',
    routeId: 'ORAL',
    siteId: 'ORAL',
  };

  it('bloqueia rotavírus acima do máximo seed', () => {
    const birth = new Date('2020-01-01');
    const applied = new Date('2021-01-01'); // ~1 ano > 245d
    const errors = validateAgeForApplications([baseApp], birth, applied);
    expect(errors.some((e) => e.includes('acima do máximo'))).toBe(true);
  });

  it('aceita BCG em RN', () => {
    const birth = new Date('2026-08-01');
    const applied = new Date('2026-08-10');
    const errors = validateAgeForApplications(
      [{ ...baseApp, immunobiologicalId: 'BCG', doseId: 'DU', routeId: 'ID', siteId: 'RD', leprosyContact: false }],
      birth,
      applied,
    );
    expect(errors).toEqual([]);
  });

  it('cobre ≥50 faixas no seed PNI', () => {
    const { AGE_RANGES_SEED, getAgeRanges } = require('./catalog');
    expect(AGE_RANGES_SEED.length).toBeGreaterThanOrEqual(50);
    expect(getAgeRanges().length).toBeGreaterThanOrEqual(AGE_RANGES_SEED.length);
  });
});

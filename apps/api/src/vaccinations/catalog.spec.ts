import { validateVaccineApplications } from './catalog';
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
    const { IMMUNOBIOLOGICALS, STRATEGIES, resolveImmunoLediId, resolveStrategyLediId } = require('./catalog');
    expect(resolveImmunoLediId('BCG')).toBe(15);
    expect(resolveImmunoLediId('HB')).toBe(9);
    expect(resolveImmunoLediId('PENTA')).toBe(42);
    expect(resolveStrategyLediId('ROUTINE')).toBe(1);
    expect(resolveStrategyLediId('SPECIAL')).toBe(2);
    expect(IMMUNOBIOLOGICALS.length).toBeGreaterThanOrEqual(6);
    expect(STRATEGIES.length).toBe(15);
  });
});

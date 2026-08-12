import { buildIndividualEncounterLediPayload } from './ledi-individual.mapper';

describe('buildIndividualEncounterLediPayload v2', () => {
  const lotacao = {
    profissionalCNS: '898000000000000',
    cboCodigo_2002: '225125',
    cnes: '1234567',
    ine: '0000000001',
  };

  it('emite ids LEDI + lotacaoFormPrincipal', () => {
    const payload = buildIndividualEncounterLediPayload({
      uuidFicha: 'ficha-1',
      lotacao,
      startedAt: new Date('2026-08-10T12:00:00Z'),
      finishedAt: new Date('2026-08-10T12:30:00Z'),
      patient: {
        cpf: '12345678901',
        cns: '123456789012345',
        birthDate: new Date('1990-05-10'),
        sex: 'FEMALE',
      },
      careLocation: 'UBS',
      shift: 'MORNING',
      encounterType: 'CONSULTA',
      clinical: {
        outcomes: ['ALTA'],
        ciapCodes: ['A98'],
        cidCodes: ['J06'],
        weightKg: 70,
        heightCm: 165,
        soapSubjective: 'Cefaleia',
      },
    });

    expect(payload.mapperVersion).toBe('ledi-individual-v2');
    expect(payload.headerTransport.cnes).toBe('1234567');
    expect(payload.headerTransport.cboCodigo_2002).toBe('225125');
    expect(payload.headerTransport.lotacaoFormPrincipal).toEqual({
      profissionalCNS: '898000000000000',
      cboCodigo_2002: '225125',
      cnes: '1234567',
      ine: '0000000001',
    });
    const child = payload.atendimentosIndividuais[0];
    expect(child.condutas).toEqual([9]);
    expect(child.turno).toBe(1);
    expect(child.localDeAtendimento).toBe(1);
    expect(child.tipoAtendimento).toBe(2);
    expect(child.sexo).toBe(1);
    expect(child.cpfCidadao).toBe('12345678901');
  });
});

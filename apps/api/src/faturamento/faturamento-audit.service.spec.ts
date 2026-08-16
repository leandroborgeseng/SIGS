import {
  FaturamentoAuditService,
  isValidCiapFormat,
  parseCompetencia,
} from './faturamento-audit.service';

describe('faturamento audit helpers', () => {
  it('parseCompetencia aceita YYYY-MM e YYYYMM', () => {
    const a = parseCompetencia('2026-08');
    expect(a.ym).toBe('202608');
    expect(a.display).toBe('2026-08');
    expect(a.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(a.end.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(parseCompetencia('202608').ym).toBe('202608');
  });

  it('parseCompetencia rejeita inválido', () => {
    expect(() => parseCompetencia('2026')).toThrow(/competencia/);
    expect(() => parseCompetencia('2026-13')).toThrow(/mês/);
  });

  it('valida formato CIAP', () => {
    expect(isValidCiapFormat('A98')).toBe(true);
    expect(isValidCiapFormat('T90')).toBe(true);
    expect(isValidCiapFormat('a98')).toBe(true);
    expect(isValidCiapFormat('XX')).toBe(false);
    expect(isValidCiapFormat('123')).toBe(false);
  });
});

describe('FaturamentoAuditService', () => {
  it('marca CNES inativo, INE divergente, SIGTAP desconhecido e CIAP inválido', async () => {
    const payload = {
      uuidFicha: 'x',
      headerTransport: {
        cnes: '9647198',
        ine: '0001667653',
        profissionalCNS: '898001234567890',
        cboCodigo_2002: '225125',
        codigoIbgeMunicipio: '3516200',
      },
      codigoProcedimento: '9999999999',
      atendimentosIndividuais: [
        {
          condutas: [1],
          problemaCondicaoAvaliada: { ciaps: ['!!!'], cid10: [] },
          procedimentos: [{ codigo: '9999999999' }],
        },
      ],
    };

    const prisma = {
      facility: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'f1',
            cnes: '9647198',
            active: false,
            ibgeCode: '3516200',
            name: 'UBS Inativa',
          },
        ]),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            ine: '0001667653',
            active: true,
            name: 'eSF',
            facility: { cnes: '1111111' },
          },
        ]),
      },
      professionalAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      productionBatch: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'b1',
            kind: 'individual_encounter',
            payloadJson: JSON.stringify(payload),
          },
        ]),
      },
      productionRecord: { findMany: jest.fn().mockResolvedValue([]) },
      encounter: { findMany: jest.fn().mockResolvedValue([]) },
      sigtapProcedure: {
        findMany: jest.fn().mockResolvedValue([
          { code: '0301010064', active: true, competencia: '202608' },
        ]),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };

    const sigtap = {
      enrichProcedureCodes: jest.fn().mockResolvedValue({
        '9999999999': { code: '9999999999', known: false, name: null, active: false },
        '0301010064': { code: '0301010064', known: true, name: 'Consulta', active: true },
      }),
    };

    const service = new FaturamentoAuditService(prisma as never, sigtap as never);
    const report = await service.audit({ competencia: '2026-08', ibge: '3516200' });
    const codes = new Set(report.findings.map((f) => f.code));
    expect(codes.has('CNES_INACTIVE')).toBe(true);
    expect(codes.has('INE_CNES_MISMATCH')).toBe(true);
    expect(codes.has('SIGTAP_UNKNOWN')).toBe(true);
    expect(codes.has('CIAP_FORMAT')).toBe(true);
    expect(report.counts.bySeverity.blocker).toBeGreaterThan(0);
    expect(report.competencia).toBe('2026-08');
  });

  it('bloqueia ficha sem conduta', async () => {
    const payload = {
      headerTransport: {
        cnes: '9647198',
        ine: '0001667653',
        profissionalCNS: '898001234567890',
        cboCodigo_2002: '225125',
      },
      atendimentosIndividuais: [{ condutas: [], problemaCondicaoAvaliada: { ciaps: ['A98'] } }],
    };
    const prisma = {
      facility: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'f1', cnes: '9647198', active: true, ibgeCode: '3516200', name: 'UBS' },
        ]),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            ine: '0001667653',
            active: true,
            name: 'eSF',
            facility: { cnes: '9647198' },
          },
        ]),
      },
      professionalAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      productionBatch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b2', kind: 'individual_encounter', payloadJson: JSON.stringify(payload) },
        ]),
      },
      productionRecord: { findMany: jest.fn().mockResolvedValue([]) },
      encounter: { findMany: jest.fn().mockResolvedValue([]) },
      sigtapProcedure: {
        findMany: jest.fn().mockResolvedValue([
          { code: '0301010064', active: true, competencia: '202608' },
        ]),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };
    const sigtap = {
      enrichProcedureCodes: jest.fn().mockResolvedValue({
        '0301010064': { code: '0301010064', known: true, name: 'Consulta', active: true },
      }),
    };
    const service = new FaturamentoAuditService(prisma as never, sigtap as never);
    const report = await service.audit({ competencia: '2026-08' });
    expect(report.findings.some((f) => f.code === 'CONDUTA_MISSING')).toBe(true);
  });

  it('marca CNS_NOT_IN_MUNICIPAL_CNES quando CNS não está no snapshot PF Franca', async () => {
    const payload = {
      headerTransport: {
        cnes: '9647198',
        ine: '0001667653',
        profissionalCNS: '898001234567890',
        cboCodigo_2002: '225125',
        codigoIbgeMunicipio: '3516200',
      },
      atendimentosIndividuais: [{ condutas: [1], problemaCondicaoAvaliada: { ciaps: ['A98'] } }],
    };
    const prisma = {
      facility: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'f1', cnes: '9647198', active: true, ibgeCode: '3516200', name: 'UBS' },
        ]),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            ine: '0001667653',
            active: true,
            name: 'eSF',
            facility: { cnes: '9647198' },
          },
        ]),
      },
      professionalAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      productionBatch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b3', kind: 'individual_encounter', payloadJson: JSON.stringify(payload) },
        ]),
      },
      productionRecord: { findMany: jest.fn().mockResolvedValue([]) },
      encounter: { findMany: jest.fn().mockResolvedValue([]) },
      sigtapProcedure: {
        findMany: jest.fn().mockResolvedValue([
          { code: '0301010064', active: true, competencia: '202608' },
        ]),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };
    const sigtap = {
      enrichProcedureCodes: jest.fn().mockResolvedValue({
        '0301010064': { code: '0301010064', known: true, name: 'Consulta', active: true },
      }),
    };
    const service = new FaturamentoAuditService(prisma as never, sigtap as never);
    const report = await service.audit({
      competencia: '2026-08',
      ibge: '3516200',
      gestao: 'municipal',
    });
    expect(report.gestao).toBe('municipal');
    expect(report.findings.some((f) => f.code === 'CNS_NOT_IN_MUNICIPAL_CNES')).toBe(true);
    expect(report.findings.some((f) => f.code === 'CNS_NOT_LINKED')).toBe(false);
  });

  it('não marca CNS_NOT_IN_MUNICIPAL_CNES para CNS presente no PF municipal', async () => {
    const payload = {
      headerTransport: {
        cnes: '9647198',
        ine: '0001667653',
        profissionalCNS: '980016296836967',
        cboCodigo_2002: '225125',
        codigoIbgeMunicipio: '3516200',
      },
      atendimentosIndividuais: [{ condutas: [1], problemaCondicaoAvaliada: { ciaps: ['A98'] } }],
    };
    const prisma = {
      facility: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'f1', cnes: '9647198', active: true, ibgeCode: '3516200', name: 'UBS' },
        ]),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            ine: '0001667653',
            active: true,
            name: 'eSF',
            facility: { cnes: '9647198' },
          },
        ]),
      },
      professionalAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            active: true,
            cbo: '225125',
            facilityId: 'f1',
            teamId: 't1',
            professional: { cns: '980016296836967' },
            facility: { cnes: '9647198' },
            team: { ine: '0001667653' },
          },
        ]),
      },
      productionBatch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b4', kind: 'individual_encounter', payloadJson: JSON.stringify(payload) },
        ]),
      },
      productionRecord: { findMany: jest.fn().mockResolvedValue([]) },
      encounter: { findMany: jest.fn().mockResolvedValue([]) },
      sigtapProcedure: {
        findMany: jest.fn().mockResolvedValue([
          { code: '0301010064', active: true, competencia: '202608' },
        ]),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };
    const sigtap = {
      enrichProcedureCodes: jest.fn().mockResolvedValue({
        '0301010064': { code: '0301010064', known: true, name: 'Consulta', active: true },
      }),
    };
    const service = new FaturamentoAuditService(prisma as never, sigtap as never);
    const report = await service.audit({
      competencia: '2026-08',
      ibge: '3516200',
      gestao: 'municipal',
    });
    expect(report.findings.some((f) => f.code === 'CNS_NOT_IN_MUNICIPAL_CNES')).toBe(false);
  });
});

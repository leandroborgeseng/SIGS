import { ProductionService } from './production.service';

describe('ProductionService lifecycle', () => {
  function makeService(row: Record<string, unknown>) {
    const store = { ...row };
    const prisma = {
      productionBatch: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...store })),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(store, data);
          return { ...store };
        }),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      audit: jest.fn(),
    };
    const sigtap = {
      enrichProcedureCodes: jest.fn().mockResolvedValue({}),
    };
    const service = new ProductionService(prisma as never, sigtap as never);
    return { service, prisma, store };
  }

  it('reprocess sem bloqueio promove error → ready', async () => {
    const { service, store } = makeService({
      id: 'b1',
      kind: 'individual_encounter',
      status: 'error',
      rfIdsCsv: 'RF-10.20',
      payloadJson: JSON.stringify({
        uuidFicha: 'u',
        headerTransport: {
          cnes: '1234567',
          profissionalCNS: '898001234567890',
          cboCodigo_2002: '225125',
          ine: '0000123456',
          codigoIbgeMunicipio: '3516200',
        },
        atendimentosIndividuais: [
          {
            cpfCidadao: '12345678901',
            condutas: [9],
            turno: 1,
            localDeAtendimento: 1,
            problemaCondicaoAvaliada: { ciaps: ['A98'], cid10: ['I10'] },
          },
        ],
      }),
      errorMessage: 'old',
      createdAt: new Date('2026-08-11T12:00:00Z'),
    });

    const out = await service.reprocess('b1');
    expect(out.outcome).toBe('ready');
    expect(store.status).toBe('ready');
    expect(store.errorMessage).toBeNull();
  });

  it('reprocess com bloqueio marca error', async () => {
    const { service, store } = makeService({
      id: 'b2',
      kind: 'individual_encounter',
      status: 'draft',
      rfIdsCsv: '',
      payloadJson: JSON.stringify({
        uuidFicha: 'u',
        headerTransport: { cnes: '1234567' },
        atendimentosIndividuais: [{ condutas: [] }],
      }),
      errorMessage: null,
      createdAt: new Date('2026-08-11T12:00:00Z'),
    });

    const out = await service.reprocess('b2');
    expect(out.outcome).toBe('error');
    expect(store.status).toBe('error');
    expect(String(store.errorMessage)).toMatch(/conduta|Conduta|desfecho/i);
  });

  it('reopen só a partir de sent', async () => {
    const { service, store } = makeService({
      id: 'b3',
      kind: 'vaccination',
      status: 'sent',
      rfIdsCsv: '',
      payloadJson: '{}',
      errorMessage: null,
      createdAt: new Date(),
    });
    const out = await service.reopen('b3');
    expect(out.status).toBe('ready');
    expect(store.status).toBe('ready');
  });
});

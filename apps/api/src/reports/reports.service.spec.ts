import { ReportsService } from './reports.service';

describe('ReportsService aggregation', () => {
  it('agrupa atendimentos por status', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            status: 'COMPLETED',
            startedAt: new Date(),
            finishedAt: new Date(),
            facility: { name: 'UBS', cnes: '1' },
            patient: { civilName: 'A', socialName: null, cpf: null },
            professional: null,
          },
          {
            id: '2',
            status: 'WAITING',
            startedAt: new Date(),
            finishedAt: null,
            facility: { name: 'UBS', cnes: '1' },
            patient: { civilName: 'B', socialName: null, cpf: null },
            professional: null,
          },
        ]),
      },
    };
    const service = new ReportsService(prisma as never);
    const out = await service.encounters();
    expect(out.total).toBe(2);
    expect(out.byStatus.COMPLETED).toBe(1);
    expect(out.byStatus.WAITING).toBe(1);
  });
});

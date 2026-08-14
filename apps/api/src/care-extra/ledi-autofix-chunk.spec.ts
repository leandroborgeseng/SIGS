import { LediFaoBatchService } from './ledi-fao-batch.service';

describe('LediFaoBatchService autoFixInChunks', () => {
  it('processa em fatias, persiste avanço e retoma do offset', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const items = ids.map((id) => ({
      id,
      fileName: `${id}.xml`,
      findingsJson: '[]',
      previneJson: null,
      currentXml: '<xml/>',
      currentObjectKey: null,
    }));

    const findMany = jest.fn();
    const findUnique = jest.fn();
    const update = jest.fn();
    const count = jest.fn();
    const groupBy = jest.fn();
    const audit = jest.fn();

    findUnique.mockResolvedValue({
      id: 'batch-1',
      name: 'Lote',
      status: 'analyzed',
      createdAt: new Date(),
      updatedAt: new Date(),
      summaryJson: JSON.stringify({
        expectedTipo: 'FAI',
        total: 5,
        withBlockers: 0,
        siapsReady: 5,
        treatment: {
          baseline: { fichas: 5, bloqueioEnvio: 0, riscoFaturamento: 0, indicadores: 0, ideais: 5 },
          current: { fichas: 5, bloqueioEnvio: 0, riscoFaturamento: 0, indicadores: 0, ideais: 5 },
          fichasCorrigidasAcumulado: 0,
          ultimaCorrecaoQtd: 0,
          ultimaCorrecaoEm: null,
        },
      }),
    });
    findMany.mockImplementation(async (args: { select?: { id?: boolean }; where?: { id?: { in?: string[] } } }) => {
      if (args.select?.id) return ids.map((id) => ({ id }));
      if (args.where?.id?.in) return items.filter((it) => args.where!.id!.in!.includes(it.id));
      return items.map((it) => ({
        status: 'conformant',
        findingsJson: '[]',
        autoFixableCodes: '',
        previneJson: null,
        fileName: it.fileName,
        fichaTipo: 'FAI',
      }));
    });
    count.mockResolvedValue(5);
    groupBy.mockResolvedValue([]);
    update.mockResolvedValue({});

    const prisma = {
      lediFaoBatch: { findUnique, update },
      lediFaoBatchItem: { findMany, count, groupBy, update: jest.fn(), updateMany: jest.fn() },
      audit,
    };
    const storage = {
      getText: jest.fn(),
      putXml: jest.fn().mockResolvedValue({ key: 'k', sha256: 's' }),
      getDriver: jest.fn().mockReturnValue('local'),
    };

    const svc = new LediFaoBatchService(prisma as never, storage as never);
    const ticks: Array<{ processed: number; total: number }> = [];
    const first = await svc.autoFixInChunks(
      'batch-1',
      { stNaoPossuiCpf: true },
      {
        chunkSize: 2,
        startOffset: 0,
        onProgress: async (p) => {
          ticks.push({ processed: p.processed, total: p.total });
        },
      },
    );
    expect(first.total).toBe(5);
    expect(first.processed).toBe(5);
    expect(ticks.map((t) => t.processed)).toEqual([2, 4, 5]);

    const resumeTicks: number[] = [];
    const resumed = await svc.autoFixInChunks(
      'batch-1',
      { stNaoPossuiCpf: true },
      {
        chunkSize: 2,
        startOffset: 4,
        onProgress: async (p) => {
          resumeTicks.push(p.processed);
        },
      },
    );
    expect(resumed.processed).toBe(5);
    expect(resumeTicks).toEqual([5]);
  });
});

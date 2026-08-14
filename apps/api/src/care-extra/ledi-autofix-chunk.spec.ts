import { LediFaoBatchService } from './ledi-fao-batch.service';

describe('LediFaoBatchService autoFixInChunks', () => {
  function makeSvc(ids: string[], findingsCode = 'ST_NAO_POSSUI_CPF') {
    const items = ids.map((id) => ({
      id,
      fileName: `${id}.xml`,
      findingsJson: JSON.stringify([{ code: findingsCode, severity: 'BLOCKER' }]),
      autoFixableCodes: findingsCode,
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
        total: ids.length,
        withBlockers: ids.length,
        siapsReady: 0,
        treatment: {
          baseline: {
            fichas: ids.length,
            bloqueioEnvio: ids.length,
            riscoFaturamento: 0,
            indicadores: 0,
            ideais: 0,
          },
          current: {
            fichas: ids.length,
            bloqueioEnvio: ids.length,
            riscoFaturamento: 0,
            indicadores: 0,
            ideais: 0,
          },
          fichasCorrigidasAcumulado: 0,
          ultimaCorrecaoQtd: 0,
          ultimaCorrecaoEm: null,
        },
      }),
    });
    findMany.mockImplementation(
      async (args: {
        select?: { id?: boolean; findingsJson?: boolean };
        where?: { id?: { in?: string[] }; batchId?: string };
      }) => {
        if (args.select?.findingsJson || args.select?.id) {
          // listItemIds com onlyCode (precisa findings) ou só id
          if (args.select.findingsJson) {
            return items.map((it) => ({
              id: it.id,
              findingsJson: it.findingsJson,
              autoFixableCodes: it.autoFixableCodes,
              previneJson: null,
            }));
          }
          return ids.map((id) => ({ id }));
        }
        if (args.where?.id?.in) return items.filter((it) => args.where!.id!.in!.includes(it.id));
        return items.map((it) => ({
          status: 'with_blockers',
          findingsJson: it.findingsJson,
          autoFixableCodes: it.autoFixableCodes,
          previneJson: null,
          fileName: it.fileName,
          fichaTipo: 'FAI',
        }));
      },
    );
    count.mockResolvedValue(ids.length);
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

    return {
      svc: new LediFaoBatchService(prisma as never, storage as never),
      findMany,
    };
  }

  it('processa em fatias, persiste avanço e retoma do offset', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const { svc } = makeSvc(ids);
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

  it('onlyCode: total real >300 (não trava em página da UI)', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `f${i}`);
    const { svc } = makeSvc(ids, 'ST_NAO_POSSUI_CPF');
    const ticks: Array<{ processed: number; total: number }> = [];
    const out = await svc.autoFixInChunks(
      'batch-1',
      { stNaoPossuiCpf: true, onlyCode: 'ST_NAO_POSSUI_CPF' },
      {
        chunkSize: 150,
        onProgress: async (p) => {
          ticks.push({ processed: p.processed, total: p.total });
        },
      },
    );
    expect(out.total).toBe(450);
    expect(out.processed).toBe(450);
    expect(ticks[0]?.total).toBe(450);
    expect(ticks[ticks.length - 1]).toEqual({ processed: 450, total: 450 });
    // Nunca reporta total=300 quando há 450 afetadas
    expect(ticks.every((t) => t.total === 450)).toBe(true);
  });
});

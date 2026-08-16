import { VaccinationsService } from './vaccinations.service';
import { STOCK_MVP } from './catalog';

describe('VaccinationsService stock MVP', () => {
  function makeStockService(prisma: Record<string, unknown>) {
    const clinicalCore = { persistNativeEncounter: jest.fn().mockResolvedValue(undefined) };
    return new VaccinationsService(prisma as never, clinicalCore as never);
  }

  it('STOCK_MVP declara o que não é (sem IoT contínuo)', () => {
    expect(STOCK_MVP.status).toBe('beyond-mvp');
    expect(STOCK_MVP.notIncluded.some((n) => /Monitoramento contínuo/i.test(n))).toBe(true);
    expect(STOCK_MVP.features.applyDecrementWhenStockExists).toBe(true);
    expect(STOCK_MVP.features.voidRestoreQuantity).toBe(true);
  });

  it('createStock cria lote e movimento ENTRY', async () => {
    const created = {
      id: 's1',
      facilityId: 'f1',
      immunobiologicalId: 'BCG',
      lot: 'L1',
      quantity: 10,
      unit: 'dose',
      targetTempMinC: 2,
      targetTempMaxC: 8,
    };
    const prisma = {
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      vaccinationStockLot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn(),
      },
      vaccinationStockMovement: { create: jest.fn() },
      audit: jest.fn(),
    };
    const service = makeStockService(prisma);
    const out = await service.createStock({
      facilityId: 'f1',
      immunobiologicalId: 'BCG',
      lot: 'L1',
      quantity: 10,
    });
    expect(prisma.vaccinationStockLot.create).toHaveBeenCalled();
    expect(prisma.vaccinationStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'ENTRY', quantityDelta: 10 }),
      }),
    );
    expect(out.stock.status).toBe('beyond-mvp');
  });

  it('createStock soma qty se lote já existir', async () => {
    const existing = {
      id: 's1',
      facilityId: 'f1',
      immunobiologicalId: 'BCG',
      lot: 'L1',
      quantity: 5,
      manufacturer: null,
      expiresAt: null,
      targetTempMinC: 2,
      targetTempMaxC: 8,
      roomLabel: null,
    };
    const prisma = {
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      vaccinationStockLot: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...existing, quantity: 8 }),
      },
      vaccinationStockMovement: { create: jest.fn() },
      audit: jest.fn(),
    };
    const service = makeStockService(prisma);
    await service.createStock({
      facilityId: 'f1',
      immunobiologicalId: 'BCG',
      lot: 'L1',
      quantity: 3,
    });
    expect(prisma.vaccinationStockLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 8 }),
      }),
    );
  });

  it('void devolve qty das baixas APPLY', async () => {
    const prisma = {
      vaccinationRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v1',
          status: 'READY',
          productionBatchId: 'b1',
          applicationsJson: '[]',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'v1',
          status: 'VOID',
          applicationsJson: '[]',
          patient: {},
          facility: {},
          professional: null,
        }),
      },
      productionBatch: {
        findUnique: jest.fn().mockResolvedValue({ id: 'b1', status: 'ready', payloadJson: '{}' }),
        update: jest.fn(),
      },
      vaccinationStockMovement: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'm1', stockLotId: 's1', quantityDelta: -1, kind: 'APPLY' },
        ]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      vaccinationStockLot: {
        update: jest.fn(),
      },
      vaccinationSupplyMovement: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      vaccinationSupply: { update: jest.fn() },
      audit: jest.fn(),
    };
    const service = makeStockService(prisma);
    const out = await service.void('v1', { acknowledgeLocalOnly: true });
    expect(prisma.vaccinationStockLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ quantity: { increment: 1 } }),
      }),
    );
    expect(prisma.vaccinationStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'VOID_RETURN', quantityDelta: 1 }),
      }),
    );
    expect(out.voidMeta.stockRestored).toEqual([{ stockLotId: 's1', quantity: 1 }]);
  });
});

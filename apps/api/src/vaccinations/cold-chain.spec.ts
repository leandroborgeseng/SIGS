import { VaccinationsService } from './vaccinations.service';
import { STOCK_MVP } from './catalog';

describe('VaccinationsService cold chain + supplies', () => {
  function makeService(prisma: Record<string, unknown>) {
    const clinicalCore = { persistNativeEncounter: jest.fn().mockResolvedValue(undefined) };
    return new VaccinationsService(prisma as never, clinicalCore as never);
  }

  it('STOCK_MVP beyond-mvp inclui equipamento, caixa e insumos', () => {
    expect(STOCK_MVP.status).toBe('beyond-mvp');
    expect(STOCK_MVP.features.coldEquipmentRegistry).toBe(true);
    expect(STOCK_MVP.features.thermalBoxRegistry).toBe(true);
    expect(STOCK_MVP.features.manualTempReadings).toBe(true);
    expect(STOCK_MVP.features.supplyLinksAndConsume).toBe(true);
    expect(STOCK_MVP.notIncluded.some((n) => /IoT/i.test(n))).toBe(true);
    expect(STOCK_MVP.notIncluded.some((n) => /equipamentos frios/i.test(n))).toBe(false);
  });

  it('createColdEquipment valida faixa e persiste', async () => {
    const created = {
      id: 'eq1',
      facilityId: 'f1',
      code: 'G1',
      label: 'Geladeira 1',
      kind: 'REFRIGERATOR',
      targetTempMinC: 2,
      targetTempMaxC: 8,
      status: 'ACTIVE',
    };
    const prisma = {
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      vaccinationColdEquipment: { create: jest.fn().mockResolvedValue(created) },
      audit: jest.fn(),
    };
    const out = await makeService(prisma).createColdEquipment({
      facilityId: 'f1',
      code: 'G1',
      label: 'Geladeira 1',
      targetTempMinC: 2,
      targetTempMaxC: 8,
    });
    expect(prisma.vaccinationColdEquipment.create).toHaveBeenCalled();
    expect(out.stock.status).toBe('beyond-mvp');
  });

  it('createTempReading marca withinRange=false fora da faixa', async () => {
    const prisma = {
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      vaccinationColdEquipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'eq1',
          facilityId: 'f1',
          active: true,
          targetTempMinC: 2,
          targetTempMaxC: 8,
        }),
      },
      vaccinationThermalBox: { findUnique: jest.fn() },
      vaccinationTempReading: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'r1', ...data })),
      },
      audit: jest.fn(),
    };
    const out = await makeService(prisma).createTempReading({
      facilityId: 'f1',
      coldEquipmentId: 'eq1',
      temperatureC: 12,
    });
    expect(out.withinRange).toBe(false);
    expect(prisma.vaccinationTempReading.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ withinRange: false, temperatureC: 12 }),
      }),
    );
  });

  it('createSupplyLink vincula imuno a insumo', async () => {
    const prisma = {
      vaccinationSupply: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sup1', active: true, facilityId: 'f1' }),
      },
      vaccinationSupplyLink: {
        upsert: jest.fn().mockResolvedValue({
          id: 'lnk1',
          immunobiologicalId: 'BCG',
          supplyId: 'sup1',
          qtyPerDose: 1,
          supply: { id: 'sup1', sku: 'SER-3ML', label: 'Seringa 3ml', unit: 'un', facilityId: 'f1' },
        }),
      },
      audit: jest.fn(),
    };
    const out = await makeService(prisma).createSupplyLink({
      immunobiologicalId: 'BCG',
      supplyId: 'sup1',
      qtyPerDose: 1,
    });
    expect(out.immunobiologicalId).toBe('BCG');
    expect(prisma.vaccinationSupplyLink.upsert).toHaveBeenCalled();
  });

  it('createStock aceita coldEquipmentId e herda faixa/rótulo', async () => {
    const prisma = {
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      vaccinationColdEquipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'eq1',
          facilityId: 'f1',
          active: true,
          code: 'G1',
          label: 'Geladeira 1',
          targetTempMinC: 2,
          targetTempMaxC: 8,
        }),
      },
      vaccinationStockLot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 's1',
          facilityId: 'f1',
          immunobiologicalId: 'BCG',
          lot: 'L1',
          quantity: 10,
          coldEquipmentId: 'eq1',
          roomLabel: 'G1 — Geladeira 1',
          targetTempMinC: 2,
          targetTempMaxC: 8,
        }),
      },
      vaccinationStockMovement: { create: jest.fn() },
      audit: jest.fn(),
    };
    await makeService(prisma).createStock({
      facilityId: 'f1',
      immunobiologicalId: 'BCG',
      lot: 'L1',
      quantity: 10,
      coldEquipmentId: 'eq1',
    });
    expect(prisma.vaccinationStockLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coldEquipmentId: 'eq1',
          roomLabel: 'G1 — Geladeira 1',
          targetTempMinC: 2,
          targetTempMaxC: 8,
        }),
      }),
    );
  });
});

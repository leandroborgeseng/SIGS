import { VaccinationsService } from './vaccinations.service';

describe('VaccinationsService void', () => {
  function make(overrides: Record<string, unknown> = {}) {
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
      audit: jest.fn(),
      ...overrides,
    };
    const clinicalCore = { persistNativeEncounter: jest.fn() };
    return { service: new VaccinationsService(prisma as never, clinicalCore as never), prisma };
  }

  it('exige acknowledgeLocalOnly', async () => {
    const { service } = make();
    await expect(service.void('v1', {})).rejects.toThrow(/acknowledgeLocalOnly/);
  });

  it('anula e marca batch error', async () => {
    const { service, prisma } = make();
    const out = await service.void('v1', { acknowledgeLocalOnly: true, reason: 'erro digitação' });
    expect(prisma.vaccinationRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'VOID' }),
      }),
    );
    expect(prisma.productionBatch.update).toHaveBeenCalled();
    expect(out.voidMeta.localOnly).toBe(true);
    expect(out.voidMeta.ministryRecall).toBe(false);
  });
});

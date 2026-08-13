import { CareExtraService } from './care-extra.service';

describe('CareExtraService', () => {
  it('anula rascunho dental IN_PROGRESS → VOID', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          status: 'IN_PROGRESS',
          productionBatchId: 'b1',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'd1',
          status: 'VOID',
          proceduresJson: '[]',
          odontogramJson: '{}',
          outcomesJson: '[]',
          careJson: '{}',
          assignmentId: null,
          patientId: 'p1',
          facilityId: 'f1',
          professionalId: null,
          encounterType: 'CONSULTA',
          anamnese: null,
          startedAt: new Date(),
          finishedAt: new Date(),
          productionBatchId: 'b1',
          createdAt: new Date(),
          updatedAt: new Date(),
          patient: {},
          facility: {},
          professional: null,
        }),
      },
      productionBatch: {
        update: jest.fn().mockResolvedValue({ id: 'b1' }),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CareExtraService(prisma as never);
    const out = await service.voidDental('d1', { reason: 'teste' });
    expect(out.status).toBe('VOID');
    expect(prisma.productionBatch.update).toHaveBeenCalled();
    expect(prisma.audit).toHaveBeenCalledWith(
      'void',
      'dental_encounter',
      'd1',
      expect.any(Array),
      expect.objectContaining({ reason: 'teste' }),
    );
  });

  it('recusa VOID de dental já COMPLETED', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue({ id: 'd1', status: 'COMPLETED' }),
      },
    };
    const service = new CareExtraService(prisma as never);
    await expect(service.voidDental('d1', {})).rejects.toThrow(/já finalizado/);
  });

  it('sync em lote da fila odonto percorre encounters da competência', async () => {
    const prisma = {
      dentalEncounter: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]),
      },
    };
    const service = new CareExtraService(prisma as never);
    jest
      .spyOn(service, 'syncDentalBillingQueue')
      .mockResolvedValueOnce({ productionBatchId: 'b1', bucket: 'ok', blockers: 0 })
      .mockRejectedValueOnce(new Error('boom'));
    const out = await service.syncDentalFaturamentoQueueBatch({ competencia: '2026-08' });
    expect(out.total).toBe(2);
    expect(out.synced).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.limit).toBe(500);
    expect(out.capped).toBe(false);
    expect(out.matchedTotal).toBe(2);
    expect(prisma.dentalEncounter.findMany).toHaveBeenCalled();
  });

  it('bloqueia finish dental sem outcomes', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          status: 'IN_PROGRESS',
          proceduresJson: '[]',
          odontogramJson: '{}',
          careJson: '{}',
          assignmentId: null,
          encounterType: 'CONSULTA',
          startedAt: new Date(),
          patient: { cpf: '52998224725', cns: null, birthDate: new Date('1990-01-01'), sex: 'F' },
          facility: { cnes: '9647198', ibgeCode: '3516200' },
          professional: { cns: '898001234567890' },
        }),
      },
    };
    const service = new CareExtraService(prisma as never);
    await expect(service.finishDental('d1', { outcomes: [] })).rejects.toThrow(/outcomes/);
  });

  it('bloqueia finish coletivo sem participantes', async () => {
    const prisma = {
      collectiveActivity: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          status: 'IN_PROGRESS',
          participantCount: 0,
          proceduresJson: '[]',
          heldAt: new Date(),
          activityType: 'EDUCACAO_SAUDE',
          theme: 'ALIMENTACAO',
          audience: 'COMUNIDADE',
          shift: 'MANHA',
          notes: null,
          facility: { cnes: '9999999' },
          professional: null,
        }),
      },
    };
    const service = new CareExtraService(prisma as never);
    await expect(service.finishCollective('c1', {})).rejects.toThrow(/participantCount/);
  });

  it('bloqueia careType inválido na AD', async () => {
    const prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      homeCareVisit: { create: jest.fn() },
    };
    const service = new CareExtraService(prisma as never);
    await expect(
      service.openHomeCare({
        patientId: 'p1',
        facilityId: 'f1',
        careType: 'AD99',
      }),
    ).rejects.toThrow(/careType/);
    expect(prisma.homeCareVisit.create).not.toHaveBeenCalled();
  });
});

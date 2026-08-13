import { CareExtraService } from './care-extra.service';

describe('CareExtraService', () => {
  it('anula rascunho dental IN_PROGRESS → VOID', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          status: 'IN_PROGRESS',
          productionBatchId: 'b1',
          finishedAt: null,
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
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          status: 'draft',
          payloadJson: '{}',
        }),
        update: jest.fn().mockResolvedValue({ id: 'b1' }),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CareExtraService(prisma as never);
    const out = await service.voidDental('d1', { reason: 'teste' });
    expect(out.status).toBe('VOID');
    expect(out.voidMeta?.postCompleted).toBe(false);
    expect(prisma.productionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ status: 'error' }),
      }),
    );
    expect(prisma.audit).toHaveBeenCalledWith(
      'void',
      'dental_encounter',
      'd1',
      expect.any(Array),
      expect.objectContaining({ reason: 'teste', postCompleted: false }),
    );
  });

  it('anula dental COMPLETED → VOID com acknowledgeLocalOnly (sem recall Ministério)', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          status: 'COMPLETED',
          productionBatchId: 'b1',
          finishedAt: new Date('2026-08-12T12:00:00.000Z'),
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
          finishedAt: new Date('2026-08-12T12:00:00.000Z'),
          productionBatchId: 'b1',
          createdAt: new Date(),
          updatedAt: new Date(),
          patient: {},
          facility: {},
          professional: null,
        }),
      },
      productionBatch: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          status: 'ready',
          payloadJson: JSON.stringify({ encounterId: 'd1', bucket: 'ok' }),
        }),
        update: jest.fn().mockResolvedValue({ id: 'b1', status: 'error' }),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CareExtraService(prisma as never);
    const out = await service.voidDental('d1', {
      reason: 'erro de lançamento',
      acknowledgeLocalOnly: true,
    });
    expect(out.status).toBe('VOID');
    expect(out.voidMeta).toEqual(
      expect.objectContaining({
        postCompleted: true,
        localOnly: true,
        ministryRecall: false,
        batchStatusBefore: 'ready',
      }),
    );
    expect(prisma.productionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'error',
          errorMessage: expect.stringMatching(/VOID local pós-COMPLETED/),
        }),
      }),
    );
    expect(prisma.audit).toHaveBeenCalledWith(
      'void',
      'dental_encounter',
      'd1',
      expect.any(Array),
      expect.objectContaining({
        postCompleted: true,
        ministryRecall: false,
        acknowledgeLocalOnly: true,
      }),
    );
  });

  it('recusa VOID de COMPLETED sem acknowledgeLocalOnly', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue({ id: 'd1', status: 'COMPLETED' }),
      },
    };
    const service = new CareExtraService(prisma as never);
    await expect(service.voidDental('d1', {})).rejects.toThrow(/acknowledgeLocalOnly/);
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

describe('RF-12.11 histórico de odontograma', () => {
  const current = {
    id: 'curr',
    patientId: 'p1',
    facilityId: 'f1',
    startedAt: new Date('2026-08-13T12:00:00.000Z'),
  };

  function prev(overrides: Record<string, unknown> = {}) {
    return {
      id: 'prev1',
      startedAt: new Date('2026-08-01T10:00:00.000Z'),
      finishedAt: new Date('2026-08-01T11:00:00.000Z'),
      status: 'COMPLETED',
      encounterType: 'CONSULTA',
      odontogramJson: JSON.stringify({ '11': 'C', Q1: 'S' }),
      proceduresJson: JSON.stringify([
        { code: '0101020066', label: 'Selante', tooth: '11', done: true },
      ]),
      professional: { civilName: 'Dr. Anterior' },
      ...overrides,
    };
  }

  it('lista snapshots do mesmo paciente e unidade (sem VOID nem o atual)', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue(current),
        findMany: jest.fn().mockResolvedValue([prev()]),
      },
    };
    const service = new CareExtraService(prisma as never);
    const out = await service.listDentalOdontogramHistory('curr');
    expect(out.encounterId).toBe('curr');
    expect(out.patientId).toBe('p1');
    expect(out.facilityId).toBe('f1');
    expect(out.rf).toBe('RF-12.11');
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toEqual(
      expect.objectContaining({
        id: 'prev1',
        status: 'COMPLETED',
        professionalName: 'Dr. Anterior',
        markedCount: 2,
        hasDeciduous: false,
        odontogram: { '11': 'C', Q1: 'S' },
      }),
    );
    expect(out.items[0].procedures).toEqual([
      expect.objectContaining({ code: '0101020066', tooth: '11', done: true }),
    ]);
    expect(prisma.dentalEncounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 'p1',
          facilityId: 'f1',
          id: { not: 'curr' },
          status: { not: 'VOID' },
          startedAt: { lte: current.startedAt },
        }),
        take: 50,
      }),
    );
  });

  it('histórico vazio quando não há atendimentos anteriores na unidade', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue(current),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new CareExtraService(prisma as never);
    const out = await service.listDentalOdontogramHistory('curr');
    expect(out.items).toEqual([]);
  });

  it('404 se o atendimento não existe', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
    };
    const service = new CareExtraService(prisma as never);
    await expect(service.listDentalOdontogramHistory('missing')).rejects.toThrow(
      /não encontrado/,
    );
    expect(prisma.dentalEncounter.findMany).not.toHaveBeenCalled();
  });

  it('odontograma inválido no snapshot vira mapa vazio', async () => {
    const prisma = {
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue(current),
        findMany: jest.fn().mockResolvedValue([
          prev({ odontogramJson: '{broken', proceduresJson: 'not-json' }),
        ]),
      },
    };
    const service = new CareExtraService(prisma as never);
    const out = await service.listDentalOdontogramHistory('curr');
    expect(out.items[0].odontogram).toEqual({});
    expect(out.items[0].markedCount).toBe(0);
    expect(out.items[0].procedures).toEqual([]);
  });
});

import { CareExtraService } from './care-extra.service';

describe('CareExtraService', () => {
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

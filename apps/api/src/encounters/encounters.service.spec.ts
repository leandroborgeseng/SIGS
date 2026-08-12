import { EncountersService } from './encounters.service';

describe('EncountersService queue rules', () => {
  it('reusa atendimento ativo do mesmo dia em vez de 409', async () => {
    const existing = {
      id: 'e1',
      status: 'WAITING',
      patientId: 'p1',
      patient: { id: 'p1' },
      facility: { id: 'f1' },
      professional: null,
    };
    const prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1', cnes: '1' }) },
      encounter: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
      audit: jest.fn(),
    };
    const service = new EncountersService(prisma as never);
    const out = await service.open({ patientId: 'p1', facilityId: 'f1' });
    expect(out.id).toBe('e1');
    expect(out.reused).toBe(true);
    expect(prisma.encounter.create).not.toHaveBeenCalled();
    expect(prisma.audit).toHaveBeenCalledWith(
      'reuse_queue',
      'encounter',
      'e1',
      expect.any(Array),
      expect.objectContaining({ patientId: 'p1' }),
    );
  });
});

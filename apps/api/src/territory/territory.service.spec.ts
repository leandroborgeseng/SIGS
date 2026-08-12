import { TerritoryService } from './territory.service';

describe('TerritoryService', () => {
  function make(overrides: Record<string, unknown> = {}) {
    const prisma = {
      team: { findUnique: jest.fn().mockResolvedValue({ id: 't1' }) },
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      microArea: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', teamId: 't1' }),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      patientTeamLink: {
        create: jest.fn().mockResolvedValue({ id: 'l1', patientId: 'p1', teamId: 't1' }),
        findMany: jest.fn(),
      },
      audit: jest.fn(),
      ...overrides,
    };
    return { service: new TerritoryService(prisma as never), prisma };
  }

  it('bloqueia microárea de outra equipe no vínculo', async () => {
    const { service, prisma } = make();
    prisma.microArea.findUnique.mockResolvedValue({ id: 'm2', teamId: 'outra' });
    await expect(
      service.createLink({ patientId: 'p1', teamId: 't1', microAreaId: 'm2' }),
    ).rejects.toThrow(/microárea não pertence/);
  });

  it('cria vínculo válido', async () => {
    const { service, prisma } = make();
    await service.createLink({ patientId: 'p1', teamId: 't1', microAreaId: 'm1' });
    expect(prisma.patientTeamLink.create).toHaveBeenCalled();
    expect(prisma.audit).toHaveBeenCalled();
  });
});

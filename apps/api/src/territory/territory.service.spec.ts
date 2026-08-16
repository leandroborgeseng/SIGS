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
        findUnique: jest.fn().mockResolvedValue({ id: 'l1', teamId: 't1', active: true }),
        update: jest.fn().mockResolvedValue({ id: 'l1', active: false }),
      },
      household: {
        create: jest.fn().mockResolvedValue({
          id: 'h1',
          teamId: 't1',
          propertyType: 1,
          active: true,
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'h1', teamId: 't1', active: true }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'h1', active: false }),
      },
      householdFamily: {
        create: jest.fn().mockResolvedValue({ id: 'f1', householdId: 'h1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'f1', householdId: 'h1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      familyMember: {
        create: jest.fn().mockResolvedValue({ id: 'fm1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
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

  it('desativa vínculo via PATCH', async () => {
    const { service, prisma } = make({
      patientTeamLink: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'l1', teamId: 't1', active: true }),
        update: jest.fn().mockResolvedValue({ id: 'l1', active: false }),
      },
    });
    await service.updateLink('l1', { active: false });
    expect(prisma.patientTeamLink.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
  });

  it('catalogHousehold expõe tipos de imóvel LEDI', () => {
    const { service } = make();
    const cat = service.catalogHousehold();
    expect(cat.propertyTypes.some((p) => p.id === 1 && /Domicílio/.test(p.label))).toBe(true);
    expect(cat.familyRelationships.some((r) => r.id === 'RESPONSAVEL')).toBe(true);
  });

  it('bloqueia propertyType inválido no domicílio', async () => {
    const { service } = make();
    await expect(
      service.createHousehold({ teamId: 't1', propertyType: 99, street: 'Rua A' }),
    ).rejects.toThrow(/propertyType/);
  });

  it('cria domicílio com família e membros', async () => {
    const { service, prisma } = make();
    prisma.patient.findUnique.mockResolvedValue({ id: 'p1' });
    await service.createHousehold({
      teamId: 't1',
      microAreaId: 'm1',
      propertyType: 1,
      street: 'Rua Demo',
      number: '100',
      family: {
        responsiblePatientId: 'p1',
        members: [{ patientId: 'p2', relationship: 'FILHO' }],
      },
    });
    expect(prisma.household.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: 't1',
          propertyType: 1,
          families: expect.any(Object),
        }),
      }),
    );
    expect(prisma.audit).toHaveBeenCalledWith(
      'create',
      'household',
      'h1',
      expect.arrayContaining(['RF-2.29']),
      expect.any(Object),
    );
  });

  it('bloqueia microárea de outra equipe no domicílio', async () => {
    const { service, prisma } = make();
    prisma.microArea.findUnique.mockResolvedValue({ id: 'm2', teamId: 'outra' });
    await expect(
      service.createHousehold({ teamId: 't1', microAreaId: 'm2', street: 'X' }),
    ).rejects.toThrow(/microárea não pertence/);
  });

  it('desativa domicílio via PATCH', async () => {
    const { service, prisma } = make();
    await service.updateHousehold('h1', { active: false });
    expect(prisma.household.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: false }) }),
    );
  });
});

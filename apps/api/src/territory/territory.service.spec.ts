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
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      professional: { findUnique: jest.fn().mockResolvedValue({ id: 'pr1' }) },
      acsHomeVisit: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      audit: jest.fn(),
      ...overrides,
    };
    return { service: new TerritoryService(prisma as never), prisma: prisma as any };
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

  it('catalogAcsVisit expõe desfecho e motivos LEDI', () => {
    const { service } = make();
    const cat = service.catalogAcsVisit();
    expect(cat.desfechos.map((d) => d.id)).toEqual([1, 2, 3]);
    expect(cat.motivos.some((m) => m.id === 29)).toBe(true);
  });

  it('cria visita ACS com lat/long e mapUrl OSM', async () => {
    const { service, prisma } = make({
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      professional: { findUnique: jest.fn().mockResolvedValue({ id: 'pr1' }) },
      acsHomeVisit: {
        create: jest.fn().mockResolvedValue({
          id: 'v1',
          facilityId: 'f1',
          patientId: 'p1',
          householdId: 'h1',
          desfecho: 1,
          motivosJson: '[29]',
          latitude: -20.53,
          longitude: -47.4,
          shift: 'MANHA',
          status: 'RECORDED',
        }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    });
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', teamId: 't1' });
    prisma.team.findUnique.mockResolvedValue({ id: 't1', facilityId: 'f1' });

    const row = await service.createAcsVisit({
      facilityId: 'f1',
      householdId: 'h1',
      patientId: 'p1',
      desfecho: 1,
      motivos: [29],
      latitude: -20.53,
      longitude: -47.4,
    });
    expect(prisma.acsHomeVisit.create).toHaveBeenCalled();
    expect(row.mapUrl).toContain('openstreetmap.org');
    expect(row.motivos).toEqual([29]);
    expect(prisma.audit).toHaveBeenCalledWith(
      'create',
      'acs_home_visit',
      'v1',
      expect.arrayContaining(['RF-17.11', 'RF-17.12']),
      expect.any(Object),
    );
  });

  it('exige patient ou household na visita ACS', async () => {
    const { service } = make({
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      acsHomeVisit: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    });
    await expect(
      service.createAcsVisit({ facilityId: 'f1', desfecho: 1, motivos: [1] }),
    ).rejects.toThrow(/patientId e\/ou householdId/);
  });

  it('rejeita lat sem long', async () => {
    const { service } = make({
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      acsHomeVisit: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    });
    await expect(
      service.createAcsVisit({
        facilityId: 'f1',
        patientId: 'p1',
        desfecho: 1,
        motivos: [1],
        latitude: -20.5,
      }),
    ).rejects.toThrow(/latitude e longitude/);
  });
});

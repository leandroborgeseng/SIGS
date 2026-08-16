import { PatientsService } from './patients.service';

describe('PatientsService validation rules', () => {
  function make() {
    const prisma = {
      patient: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      patientIdentifier: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      audit: jest.fn(),
    };
    const service = new PatientsService(prisma as never);
    return { service, prisma };
  }

  it('exige motherName ou motherNameUnknown', async () => {
    const { service } = make();
    await expect(
      service.create({
        civilName: 'X',
        birthDate: '2000-01-01',
        sex: 'F',
      } as never),
    ).rejects.toMatchObject({ response: { errors: expect.arrayContaining([expect.stringContaining('motherName')]) } });
  });

  it('exige IBGE de nascimento quando nacionalidade BRASILEIRA', async () => {
    const { service } = make();
    await expect(
      service.create({
        civilName: 'Ana',
        birthDate: '1990-01-01',
        sex: 'F',
        motherName: 'Maria',
        nationality: 'BRASILEIRA',
      } as never),
    ).rejects.toMatchObject({
      response: { errors: expect.arrayContaining([expect.stringContaining('birthMunicipalityIbge')]) },
    });
  });

  it('exige etnia quando raça/cor indígena', async () => {
    const { service } = make();
    await expect(
      service.create({
        civilName: 'Ana',
        birthDate: '1990-01-01',
        sex: 'F',
        motherName: 'Maria',
        raceColor: 'INDIGENA',
      } as never),
    ).rejects.toMatchObject({
      response: { errors: expect.arrayContaining([expect.stringContaining('ethnicity')]) },
    });
  });

  it('atualiza paciente mesclando regras de óbito', async () => {
    const { service, prisma } = make();
    prisma.patient.findUnique.mockResolvedValue({
      id: 'p1',
      civilName: 'Maria',
      socialName: null,
      cpf: '12345678901',
      cns: '898003333333333',
      birthDate: new Date('1988-05-12'),
      sex: 'F',
      raceColor: null,
      motherName: 'Joana',
      motherNameUnknown: false,
      fatherName: null,
      fatherNameUnknown: true,
      isDeceased: false,
      deathDate: null,
      deathCertificate: null,
      phone: null,
      notes: null,
    });
    prisma.patient.update.mockImplementation(({ data }: { data: unknown }) =>
      Promise.resolve({ id: 'p1', socialName: 'Maria Exemplo', ...(data as object) }),
    );
    const out = await service.update('p1', { socialName: 'Maria Exemplo' });
    expect(out.socialName).toBe('Maria Exemplo');
    expect(prisma.audit).toHaveBeenCalled();
  });
});

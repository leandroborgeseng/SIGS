import { BadRequestException } from '@nestjs/common';
import { OrganizationService } from './organization.service';

describe('OrganizationService assignments', () => {
  it('rejeita CBO inválido', async () => {
    const prisma = {
      professional: { findUnique: jest.fn().mockResolvedValue({ id: 'pr1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      professionalAssignment: { create: jest.fn() },
    };
    const service = new OrganizationService(prisma as never);
    await expect(
      service.createAssignment({
        professionalId: 'pr1',
        facilityId: 'f1',
        cbo: 'AB',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige equipe da mesma unidade', async () => {
    const prisma = {
      professional: { findUnique: jest.fn().mockResolvedValue({ id: 'pr1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      team: { findUnique: jest.fn().mockResolvedValue({ id: 't1', facilityId: 'f2' }) },
      professionalAssignment: { create: jest.fn() },
    };
    const service = new OrganizationService(prisma as never);
    await expect(
      service.createAssignment({
        professionalId: 'pr1',
        facilityId: 'f1',
        teamId: 't1',
        cbo: '225125',
      }),
    ).rejects.toThrow(/equipe não pertence/);
  });
});

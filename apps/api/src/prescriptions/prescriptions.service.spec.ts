import { BadRequestException } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { MEDICATION_SEED } from './med-seed';

describe('PrescriptionsService', () => {
  it('seed tem medicamentos municipais mínimos', () => {
    expect(MEDICATION_SEED.some((m) => m.code === 'LOS50')).toBe(true);
    expect(MEDICATION_SEED.some((m) => m.recipeType === 'ESPECIAL')).toBe(true);
  });

  it('bloqueia item sem medicamento e sem nome livre', async () => {
    const prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      prescription: { create: jest.fn() },
    };
    const service = new PrescriptionsService(prisma as never);
    await expect(
      service.create({
        patientId: 'p1',
        facilityId: 'f1',
        items: [{ dose: '1 cp', frequency: '8/8h' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige forceOffCatalog ao emitir receita com item fora do padrão', async () => {
    const prisma = {
      prescription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rx1',
          status: 'DRAFT',
          hasOffCatalog: true,
          validUntil: null,
          recipeType: 'COMUM',
          patient: {},
          professional: null,
          facility: {},
          encounter: null,
          items: [],
        }),
        update: jest.fn(),
      },
      audit: jest.fn(),
    };
    const service = new PrescriptionsService(prisma as never);
    await expect(service.issue('rx1', {})).rejects.toThrow(/forceOffCatalog/);
    expect(prisma.prescription.update).not.toHaveBeenCalled();
  });
});

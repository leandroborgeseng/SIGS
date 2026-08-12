import { BadRequestException } from '@nestjs/common';
import { RegulationService } from './regulation.service';
import { REGULATION_PROCEDURE_SEED } from './reg-seed';

describe('RegulationService', () => {
  it('seed tem procedimentos pré-regulados', () => {
    expect(REGULATION_PROCEDURE_SEED.some((p) => p.code === 'CONS_CARDIO')).toBe(true);
    expect(REGULATION_PROCEDURE_SEED.some((p) => p.requiresCid)).toBe(true);
  });

  it('exige CID quando protocolo requer', async () => {
    const prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      regulationProcedure: {
        findUnique: jest.fn().mockResolvedValue({
          code: 'CONS_CARDIO',
          name: 'Consulta em cardiologia',
          requiresCid: true,
          active: true,
        }),
      },
      regulationRequest: { create: jest.fn() },
    };
    const service = new RegulationService(prisma as never);
    await expect(
      service.create({
        patientId: 'p1',
        facilityId: 'f1',
        procedureCode: 'CONS_CARDIO',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.regulationRequest.create).not.toHaveBeenCalled();
  });

  it('marca offProtocol quando código fora do catálogo', async () => {
    const prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      regulationProcedure: { findUnique: jest.fn().mockResolvedValue(null) },
      regulationRequest: {
        create: jest.fn().mockResolvedValue({
          id: 'r1',
          offProtocol: true,
          status: 'SUBMITTED',
          procedureCode: 'XYZ99',
        }),
      },
      audit: jest.fn(),
    };
    const service = new RegulationService(prisma as never);
    const row = await service.create({
      patientId: 'p1',
      facilityId: 'f1',
      procedureCode: 'XYZ99',
      procedureName: 'Procedimento livre',
    });
    expect(prisma.regulationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ offProtocol: true, status: 'SUBMITTED' }),
      }),
    );
    expect(row.offProtocol).toBe(true);
  });

  it('não autoriza solicitação já negada', async () => {
    const prisma = {
      regulationRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r1',
          status: 'DENIED',
          patient: {},
          facility: {},
          professional: null,
          encounter: null,
        }),
        update: jest.fn(),
      },
    };
    const service = new RegulationService(prisma as never);
    await expect(service.authorize('r1', {})).rejects.toThrow(/não permite autorização/);
    expect(prisma.regulationRequest.update).not.toHaveBeenCalled();
  });
});

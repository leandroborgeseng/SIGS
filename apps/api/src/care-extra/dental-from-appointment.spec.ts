import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CareExtraService } from './care-extra.service';

const FACILITY = {
  id: 'f1',
  cnes: '1234567',
  ibgeCode: '3516200',
  name: 'UBS Demo',
};
const PATIENT = { id: 'p1', civilName: 'Paciente Demo' };
const PROFESSIONAL = { id: 'pr1', civilName: 'Dentista Demo', cns: '898001234567890' };
const ASSIGNMENT = {
  id: 'a1',
  professionalId: PROFESSIONAL.id,
  facilityId: FACILITY.id,
  cbo: '223208',
  active: true,
  professional: PROFESSIONAL,
  facility: FACILITY,
  team: { id: 't1', name: 'eSB', ine: '0000123456' },
};

describe('openDental from appointment (RF-12.1)', () => {
  const prevIne = process.env.REQUIRE_INE_DENTAL_OPEN;

  beforeEach(() => {
    process.env.REQUIRE_INE_DENTAL_OPEN = 'true';
  });

  afterEach(() => {
    if (prevIne === undefined) delete process.env.REQUIRE_INE_DENTAL_OPEN;
    else process.env.REQUIRE_INE_DENTAL_OPEN = prevIne;
  });

  function makePrisma(slot: {
    id: string;
    patientId: string | null;
    facilityId: string | null;
    professionalId: string;
    status: string;
  }) {
    const created: Record<string, unknown>[] = [];
    const prisma = {
      appointmentSlot: {
        findUnique: jest.fn().mockResolvedValue(slot.status === 'DELETED' ? null : slot),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...slot, ...data })),
      },
      dentalEncounter: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          const row = {
            id: 'd1',
            ...data,
            startedAt: new Date('2026-08-12T10:00:00.000Z'),
            finishedAt: null,
            productionBatchId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            patient: PATIENT,
            facility: FACILITY,
            professional: PROFESSIONAL,
          };
          created.push(row);
          return Promise.resolve(row);
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...created[0],
            ...data,
            patient: PATIENT,
            facility: FACILITY,
            professional: PROFESSIONAL,
          }),
        ),
      },
      patient: { findUnique: jest.fn().mockResolvedValue(PATIENT) },
      facility: { findUnique: jest.fn().mockResolvedValue(FACILITY) },
      professionalAssignment: { findMany: jest.fn().mockResolvedValue([ASSIGNMENT]) },
      productionBatch: {
        create: jest.fn().mockResolvedValue({
          id: 'b1',
          status: 'draft',
          payloadJson: '{}',
        }),
      },
      audit: jest.fn().mockResolvedValue(undefined),
    };
    return { prisma, created };
  }

  it('abre encounter com appointmentId, marca PRESENT e tipoAtendimento=2', async () => {
    const slot = {
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'SCHEDULED',
    };
    const { prisma, created } = makePrisma(slot);
    const service = new CareExtraService(prisma as never);
    jest.spyOn(service, 'syncDentalBillingQueue' as never).mockResolvedValue(undefined as never);

    const out = await service.openDentalFromAppointment('s1', { assignmentId: ASSIGNMENT.id });

    expect(out.id).toBe('d1');
    expect(out.appointmentId).toBe('s1');
    expect(out.care.tipoAtendimento).toBe(2);
    expect(out.care.tiposConsultaOdonto).toEqual([1]);
    expect(prisma.appointmentSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PRESENT' } }),
    );
    expect(created[0]).toEqual(expect.objectContaining({ appointmentId: 's1' }));
  });

  it('reusa encounter IN_PROGRESS já vinculado', async () => {
    const slot = {
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'PRESENT',
    };
    const { prisma } = makePrisma(slot);
    prisma.dentalEncounter.findUnique = jest.fn().mockResolvedValue({
      id: 'd-existing',
      appointmentId: 's1',
      status: 'IN_PROGRESS',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      assignmentId: ASSIGNMENT.id,
      encounterType: 'CONSULTA',
      anamnese: null,
      proceduresJson: '[]',
      odontogramJson: '{}',
      outcomesJson: '[]',
      careJson: JSON.stringify({ tipoAtendimento: 2, tiposConsultaOdonto: [1] }),
      startedAt: new Date(),
      finishedAt: null,
      productionBatchId: 'b1',
      createdAt: new Date(),
      updatedAt: new Date(),
      patient: PATIENT,
      facility: FACILITY,
      professional: PROFESSIONAL,
    });
    const service = new CareExtraService(prisma as never);
    const out = await service.openDentalFromAppointment('s1', { assignmentId: ASSIGNMENT.id });
    expect(out.id).toBe('d-existing');
    expect(prisma.dentalEncounter.create).not.toHaveBeenCalled();
  });

  it('bloqueia slot sem paciente', async () => {
    const { prisma } = makePrisma({
      id: 's1',
      patientId: null,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'SCHEDULED',
    });
    const service = new CareExtraService(prisma as never);
    await expect(service.openDentalFromAppointment('s1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('404 se slot inexistente', async () => {
    const { prisma } = makePrisma({
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'DELETED',
    });
    const service = new CareExtraService(prisma as never);
    await expect(service.openDentalFromAppointment('s1', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('409 se já vinculado a encounter COMPLETED', async () => {
    const slot = {
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'PRESENT',
    };
    const { prisma } = makePrisma(slot);
    prisma.dentalEncounter.findUnique = jest.fn().mockResolvedValue({
      id: 'd-done',
      status: 'COMPLETED',
      appointmentId: 's1',
      proceduresJson: '[]',
      odontogramJson: '{}',
      outcomesJson: '[]',
      careJson: '{}',
      patient: PATIENT,
      facility: FACILITY,
      professional: PROFESSIONAL,
    });
    const service = new CareExtraService(prisma as never);
    await expect(
      service.openDentalFromAppointment('s1', { assignmentId: ASSIGNMENT.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

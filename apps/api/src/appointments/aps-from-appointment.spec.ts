import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EncountersService } from '../encounters/encounters.service';

const FACILITY = { id: 'f1', cnes: '2035871', ibgeCode: '3516200', name: 'UBS Demo' };
const PATIENT = { id: 'p1', civilName: 'Paciente Demo' };
const PROFESSIONAL = { id: 'pr1', civilName: 'Médico Demo', cns: '898001234567890' };
const ASSIGNMENT = {
  id: 'a1',
  professionalId: PROFESSIONAL.id,
  facilityId: FACILITY.id,
  cbo: '225125',
  active: true,
  professional: PROFESSIONAL,
  facility: FACILITY,
  team: { id: 't1', name: 'eSF', ine: '0002321246' },
};

describe('openAps from appointment (RF-3.5 / RF-12.1)', () => {
  const prevIne = process.env.REQUIRE_INE_APS_OPEN;

  beforeEach(() => {
    process.env.REQUIRE_INE_APS_OPEN = 'true';
  });

  afterEach(() => {
    if (prevIne === undefined) delete process.env.REQUIRE_INE_APS_OPEN;
    else process.env.REQUIRE_INE_APS_OPEN = prevIne;
  });

  function makePrisma(slot: {
    id: string;
    patientId: string | null;
    facilityId: string | null;
    professionalId: string;
    status: string;
    itemType?: string;
    careLine?: string;
  }) {
    const created: Record<string, unknown>[] = [];
    const prisma = {
      patient: { findUnique: jest.fn().mockResolvedValue(PATIENT) },
      facility: { findUnique: jest.fn().mockResolvedValue(FACILITY) },
      professional: { findUnique: jest.fn().mockResolvedValue(PROFESSIONAL) },
      professionalAssignment: {
        findUnique: jest.fn().mockResolvedValue(ASSIGNMENT),
        findMany: jest.fn().mockResolvedValue([ASSIGNMENT]),
      },
      team: { findUnique: jest.fn().mockResolvedValue(ASSIGNMENT.team) },
      encounter: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          const row = {
            id: 'e-fai',
            ...data,
            startedAt: new Date('2026-08-13T12:00:00.000Z'),
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
        update: jest.fn().mockImplementation(({ data }) => {
          const next = {
            ...created[0],
            ...data,
            patient: PATIENT,
            facility: FACILITY,
            professional: PROFESSIONAL,
          };
          created[0] = next;
          return Promise.resolve(next);
        }),
      },
      productionBatch: {
        create: jest.fn().mockResolvedValue({
          id: 'batch-1',
          kind: 'individual_encounter',
          status: 'draft',
        }),
      },
      appointmentSlot: {
        findUnique: jest.fn().mockResolvedValue(slot.status === 'DELETED' ? null : slot),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...slot, ...data })),
      },
      audit: jest.fn(),
    };
    return { prisma, created };
  }

  it('abre FAI com appointmentId, PRESENT e tipoAtendimento=2 na consulta agendada', async () => {
    const slot = {
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'SCHEDULED',
      itemType: 'CONSULTA',
      careLine: 'APS',
    };
    const { prisma, created } = makePrisma(slot);
    const service = new EncountersService(prisma as never);
    const out = await service.openApsFromAppointment('s1', { assignmentId: ASSIGNMENT.id });
    expect(out.id).toBe('e-fai');
    if (!('care' in out)) throw new Error('esperado care');
    expect(out.care.tipoAtendimento).toBe(2);
    expect(out.care.faiOrigin).toBe(true);
    expect(prisma.appointmentSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PRESENT' } }),
    );
    expect(created[0]).toEqual(expect.objectContaining({ appointmentId: 's1' }));
  });

  it('encaixe APS abre com tipoAtendimento=5', async () => {
    const slot = {
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'SCHEDULED',
      itemType: 'ENCAIXE',
      careLine: 'APS',
    };
    const { prisma } = makePrisma(slot);
    const service = new EncountersService(prisma as never);
    const out = await service.openApsFromAppointment('s1', { assignmentId: ASSIGNMENT.id });
    if (!('care' in out)) throw new Error('esperado care');
    expect(out.care.tipoAtendimento).toBe(5);
  });

  it('bloqueia abrir APS a partir de slot ODONTO', async () => {
    const { prisma } = makePrisma({
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'SCHEDULED',
      careLine: 'ODONTO',
    });
    const service = new EncountersService(prisma as never);
    await expect(service.openApsFromAppointment('s1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia slot sem paciente', async () => {
    const { prisma } = makePrisma({
      id: 's1',
      patientId: null,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'SCHEDULED',
      careLine: 'APS',
    });
    const service = new EncountersService(prisma as never);
    await expect(service.openApsFromAppointment('s1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 se slot inexistente', async () => {
    const { prisma } = makePrisma({
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'DELETED',
      careLine: 'APS',
    });
    const service = new EncountersService(prisma as never);
    await expect(service.openApsFromAppointment('s1', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reusa encounter IN_PROGRESS já vinculado', async () => {
    const slot = {
      id: 's1',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      status: 'PRESENT',
      itemType: 'CONSULTA',
      careLine: 'APS',
    };
    const { prisma } = makePrisma(slot);
    prisma.encounter.findUnique = jest.fn().mockResolvedValue({
      id: 'e-existing',
      appointmentId: 's1',
      status: 'IN_PROGRESS',
      patientId: PATIENT.id,
      facilityId: FACILITY.id,
      professionalId: PROFESSIONAL.id,
      clinicalJson: JSON.stringify({ faiOrigin: true, tipoAtendimento: 2 }),
      productionBatchId: 'b1',
      startedAt: new Date(),
      finishedAt: null,
      careLocation: 'UBS',
      shift: 'TARDE',
      encounterType: 'CONSULTA_AGENDADA',
      patient: PATIENT,
      facility: FACILITY,
      professional: PROFESSIONAL,
    });
    const service = new EncountersService(prisma as never);
    const out = await service.openApsFromAppointment('s1', { assignmentId: ASSIGNMENT.id });
    expect(out.id).toBe('e-existing');
    expect(prisma.encounter.create).not.toHaveBeenCalled();
  });
});

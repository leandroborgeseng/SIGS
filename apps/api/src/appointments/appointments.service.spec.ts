import { BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  function makeService(slot: { id: string; status: string }) {
    const prisma = {
      appointmentSlot: {
        findUnique: jest.fn().mockResolvedValue(slot),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...slot, ...data }),
        ),
      },
      professional: { findUnique: jest.fn().mockResolvedValue({ id: 'pr1' }) },
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      audit: jest.fn().mockResolvedValue({}),
    };
    const careExtra = {
      openDentalFromAppointment: jest.fn().mockResolvedValue({ id: 'd1', appointmentId: slot.id }),
    };
    const encounters = {
      openApsFromAppointment: jest.fn().mockResolvedValue({ id: 'e1', appointmentId: slot.id }),
    };
    return {
      service: new AppointmentsService(prisma as never, careExtra as never, encounters as never),
      prisma,
      careExtra,
      encounters,
    };
  }

  it('permite DELETED apenas se status atual for SCHEDULED', async () => {
    const { service, prisma } = makeService({ id: '1', status: 'SCHEDULED' });
    await service.remove('1');
    expect(prisma.appointmentSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DELETED' } }),
    );
  });

  it('bloqueia exclusão se status não for SCHEDULED', async () => {
    const { service } = makeService({ id: '1', status: 'PRESENT' });
    await expect(service.remove('1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('openDental delega para CareExtra com assignmentId (RF-12.1)', async () => {
    const { service, careExtra } = makeService({ id: 'slot-1', status: 'SCHEDULED' });
    await service.openDental('slot-1', { assignmentId: 'a1' });
    expect(careExtra.openDentalFromAppointment).toHaveBeenCalledWith('slot-1', {
      assignmentId: 'a1',
      cbo: undefined,
      anamnese: undefined,
      encounterType: undefined,
      procedures: undefined,
    });
  });

  it('openAps delega para EncountersService (RF-3.5)', async () => {
    const { service, encounters } = makeService({ id: 'slot-1', status: 'SCHEDULED' });
    await service.openAps('slot-1', { assignmentId: 'a1' });
    expect(encounters.openApsFromAppointment).toHaveBeenCalledWith('slot-1', {
      assignmentId: 'a1',
      cbo: undefined,
    });
  });

  it('create persiste itemType ENCAIXE e careLine APS', async () => {
    const { service, prisma } = makeService({ id: '1', status: 'SCHEDULED' });
    await service.create({
      professionalId: 'pr1',
      facilityId: 'f1',
      patientId: 'p1',
      startsAt: '2026-08-13T11:00:00.000Z',
      endsAt: '2026-08-13T11:20:00.000Z',
      itemType: 'ENCAIXE',
      careLine: 'APS',
    });
    expect(prisma.appointmentSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ itemType: 'ENCAIXE', careLine: 'APS' }),
      }),
    );
  });

  it('dayGrid exige from/to', async () => {
    const { service } = makeService({ id: '1', status: 'SCHEDULED' });
    await expect(service.dayGrid({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('catalog lista CONSULTA (tipo 2) e ENCAIXE (tipo 5)', () => {
    const { service } = makeService({ id: '1', status: 'SCHEDULED' });
    const cat = service.catalog();
    expect(cat.itemTypes.map((t) => [t.id, t.tipoAtendimento])).toEqual([
      ['CONSULTA', 2],
      ['ENCAIXE', 5],
    ]);
  });
});

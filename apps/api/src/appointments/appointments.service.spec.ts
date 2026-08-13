import { BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  function makeService(slot: { id: string; status: string }) {
    const prisma = {
      appointmentSlot: {
        findUnique: jest.fn().mockResolvedValue(slot),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...slot, ...data }),
        ),
      },
      audit: jest.fn().mockResolvedValue({}),
    };
    const careExtra = {
      openDentalFromAppointment: jest.fn().mockResolvedValue({ id: 'd1', appointmentId: slot.id }),
    };
    return {
      service: new AppointmentsService(prisma as never, careExtra as never),
      prisma,
      careExtra,
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
});

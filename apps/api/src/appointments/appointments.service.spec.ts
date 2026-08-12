import { BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService delete rule', () => {
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
    return {
      service: new AppointmentsService(prisma as never),
      prisma,
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
});

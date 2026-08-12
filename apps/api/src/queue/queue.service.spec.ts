import { QueueService } from './queue.service';

describe('QueueService', () => {
  it('emite senha sequencial do dia', async () => {
    const prisma = {
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f1' }) },
      queueTicket: {
        findFirst: jest.fn().mockResolvedValue({ seq: 2 }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 't1', ...data, patient: null, facility: { id: 'f1' } }),
        ),
      },
      audit: jest.fn(),
    };
    const service = new QueueService(prisma as never);
    const out = await service.emit({ facilityId: 'f1', serviceType: 'NORMAL' });
    expect(out.code).toBe('N003');
    expect(prisma.queueTicket.create).toHaveBeenCalled();
  });

  it('call-next prioriza PRIORITARIO', async () => {
    const prisma = {
      queueTicket: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'normal', status: 'WAITING' })
          .mockResolvedValueOnce({ id: 'prio', status: 'WAITING' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'prio',
          status: 'WAITING',
          code: 'P001',
          facilityId: 'f1',
          patientId: null,
          deskLabel: null,
          professionalId: null,
          encounterId: null,
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'prio',
            code: 'P001',
            status: data.status,
            deskLabel: data.deskLabel,
            patient: null,
            professional: null,
            facility: { id: 'f1' },
          }),
        ),
      },
      audit: jest.fn(),
    };
    const service = new QueueService(prisma as never);
    const out = await service.callNext('f1', { deskLabel: 'Guichê 2' });
    expect(out.status).toBe('CALLED');
    expect(out.deskLabel).toBe('Guichê 2');
  });
});

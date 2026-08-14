import { JobsService } from './jobs.service';

describe('JobsService enqueue / resume autofix', () => {
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const enqueueQ = jest.fn();
  const prisma = {
    jobRun: { findUnique, create, update },
  };
  const queue = { enqueue: enqueueQ };
  const svc = new JobsService(prisma as never, queue as never);

  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    update.mockReset();
    enqueueQ.mockReset();
  });

  it('mesmo batchId em queued/active devolve o job (não duplica)', async () => {
    findUnique.mockResolvedValue({ id: 'job-1', status: 'active' });
    const out = await svc.enqueue({
      type: 'ledi.auto-fix',
      idempotencyKey: 'ledi-auto-fix:b1',
      payload: { batchId: 'b1' },
    });
    expect(out.id).toBe('job-1');
    expect(create).not.toHaveBeenCalled();
    expect(enqueueQ).not.toHaveBeenCalled();
  });

  it('job falho no mesmo batchId é reenfileirado (retoma checkpoint)', async () => {
    findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'failed',
      resultJson: JSON.stringify({ processed: 200, total: 8000, touched: 10 }),
    });
    update.mockResolvedValue({ id: 'job-1', type: 'ledi.auto-fix', status: 'queued' });
    const out = await svc.enqueue({
      type: 'ledi.auto-fix',
      idempotencyKey: 'ledi-auto-fix:b1',
      payload: { batchId: 'b1', dto: {} },
    });
    expect(out.id).toBe('job-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'queued', errorMessage: null, attempts: 0 }),
      }),
    );
    expect(enqueueQ).toHaveBeenCalledWith(
      'ledi.auto-fix',
      expect.objectContaining({ jobRunId: 'job-1', batchId: 'b1' }),
    );
  });

  it('job completed libera a chave para uma nova corrida', async () => {
    findUnique.mockResolvedValue({ id: 'job-old', status: 'completed' });
    update.mockResolvedValue({});
    create.mockResolvedValue({ id: 'job-new', type: 'ledi.auto-fix' });
    const out = await svc.enqueue({
      type: 'ledi.auto-fix',
      idempotencyKey: 'ledi-auto-fix:b1',
      payload: { batchId: 'b1' },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { idempotencyKey: 'ledi-auto-fix:b1:done:job-old' },
      }),
    );
    expect(out.id).toBe('job-new');
    expect(enqueueQ).toHaveBeenCalled();
  });
});

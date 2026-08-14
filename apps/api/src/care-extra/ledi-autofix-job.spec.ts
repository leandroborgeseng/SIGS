import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CareExtraController } from './care-extra.controller';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';
import { LediZipChunkService } from './ledi-zip-chunk.service';
import { JobsService } from '../infra/jobs/jobs.service';
import { StorageService } from '../infra/storage/storage.service';

describe('POST auto-fix / dry-run → job 202', () => {
  let app: INestApplication;
  const countItems = jest.fn();
  const autoFix = jest.fn();
  const dryRun = jest.fn();
  const enqueue = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CareExtraController],
      providers: [
        { provide: CareExtraService, useValue: {} },
        {
          provide: LediFaoBatchService,
          useValue: { countItems, autoFix, dryRun },
        },
        { provide: JobsService, useValue: { enqueue } },
        { provide: LediZipChunkService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    countItems.mockReset();
    autoFix.mockReset();
    dryRun.mockReset();
    enqueue.mockReset();
    enqueue.mockResolvedValue({ id: 'job-af-1', status: 'queued' });
  });

  it('auto-fix de lote grande devolve 202 + jobId (não processa no request)', async () => {
    countItems.mockResolvedValue(8149);
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/batch-9/auto-fix')
      .send({ stNaoPossuiCpf: true });
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe('job-af-1');
    expect(res.body.async).toBe(true);
    expect(res.body.itemCount).toBe(8149);
    expect(autoFix).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ledi.auto-fix',
        idempotencyKey: 'ledi-auto-fix:batch-9',
        payload: expect.objectContaining({ batchId: 'batch-9', dryRun: false }),
      }),
    );
  });

  it('dry-run de lote grande também vai a job (evita timeout do gateway)', async () => {
    countItems.mockResolvedValue(8149);
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/batch-9/dry-run')
      .send({ stNaoPossuiCpf: true });
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe('job-af-1');
    expect(res.body.dryRun).toBe(true);
    expect(dryRun).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'ledi-dry-run:batch-9',
        payload: expect.objectContaining({ dryRun: true }),
      }),
    );
  });

  it('lote pequeno continua síncrono', async () => {
    countItems.mockResolvedValue(3);
    autoFix.mockResolvedValue({ id: 'batch-9', touched: 2 });
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/batch-9/auto-fix')
      .send({ stNaoPossuiCpf: true });
    expect(res.status).toBe(200);
    expect(res.body.touched).toBe(2);
    expect(autoFix).toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('auto-fix com onlyCode usa contagem real e chave :code:', async () => {
    countItems.mockResolvedValue(8149);
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/batch-9/auto-fix')
      .send({ stNaoPossuiCpf: true, onlyCode: 'ST_NAO_POSSUI_CPF' });
    expect(res.status).toBe(202);
    expect(res.body.itemCount).toBe(8149);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'ledi-auto-fix:batch-9:code:ST_NAO_POSSUI_CPF',
        payload: expect.objectContaining({
          dto: expect.objectContaining({ onlyCode: 'ST_NAO_POSSUI_CPF' }),
        }),
      }),
    );
    expect(countItems).toHaveBeenCalledWith('batch-9', {
      onlyItemIds: undefined,
      onlyCode: 'ST_NAO_POSSUI_CPF',
    });
  });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

describe('GET /v1/jobs', () => {
  let app: INestApplication;
  const get = jest.fn();
  const getByIdempotencyKey = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: { get, getByIdempotencyKey } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    get.mockReset();
    getByIdempotencyKey.mockReset();
  });

  it('GET /v1/jobs/by-key/:key devolve o job da última fatia ZIP', async () => {
    getByIdempotencyKey.mockResolvedValue({ id: 'job-1', status: 'queued' });
    const res = await request(app.getHttpServer()).get(
      '/v1/jobs/by-key/ledi-import-zip%3A11111111-2222-4333-8444-555555555555',
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('job-1');
    expect(getByIdempotencyKey).toHaveBeenCalledWith(
      'ledi-import-zip:11111111-2222-4333-8444-555555555555',
    );
  });

  it('GET /v1/jobs/:id continua no id do job', async () => {
    get.mockResolvedValue({ id: 'job-2', status: 'active' });
    const res = await request(app.getHttpServer()).get('/v1/jobs/job-2');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('job-2');
    expect(get).toHaveBeenCalledWith('job-2');
  });
});

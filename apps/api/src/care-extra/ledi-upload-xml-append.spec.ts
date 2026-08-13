import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CareExtraController } from './care-extra.controller';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';
import { LediZipChunkService } from './ledi-zip-chunk.service';
import { JobsService } from '../infra/jobs/jobs.service';
import { StorageService } from '../infra/storage/storage.service';
import { applyHttpBodyParsers } from '../infra/http-body';

describe('POST /v1/dental/ledi/batches/:batchId/upload', () => {
  let app: INestApplication;
  const appendFiles = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CareExtraController],
      providers: [
        { provide: CareExtraService, useValue: {} },
        { provide: LediFaoBatchService, useValue: { create: jest.fn(), appendFiles } },
        { provide: JobsService, useValue: { enqueue: jest.fn() } },
        {
          provide: LediZipChunkService,
          useValue: { acceptChunk: jest.fn(), readAssembled: jest.fn(), cleanup: jest.fn() },
        },
        {
          provide: StorageService,
          useValue: { put: jest.fn(), buildKey: (parts: string[]) => parts.join('/') },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    applyHttpBodyParsers(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    appendFiles.mockReset();
    appendFiles.mockResolvedValue({ id: 'batch-1', summary: { total: 2 } });
  });

  it('append multipart chama appendFiles', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/batch-1/upload')
      .attach('files', Buffer.from('<tipoDadoSerializado>4</tipoDadoSerializado>'), 'a.xml');

    expect(res.status).toBeLessThan(400);
    expect(appendFiles).toHaveBeenCalledTimes(1);
    const [batchId, files, opts] = appendFiles.mock.calls[0] as [
      string,
      Array<{ name: string }>,
      { refreshSummary?: boolean },
    ];
    expect(batchId).toBe('batch-1');
    expect(files[0]!.name).toBe('a.xml');
    expect(opts.refreshSummary).toBe(true);
  });

  it('summarize=0 não reconstrói o resumo (fatia intermediária)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/batch-1/upload?summarize=0')
      .attach('files', Buffer.from('<tipoDadoSerializado>4</tipoDadoSerializado>'), 'b.xml');

    expect(res.status).toBeLessThan(400);
    const opts = appendFiles.mock.calls[0]![2] as { refreshSummary?: boolean };
    expect(opts.refreshSummary).toBe(false);
  });
});

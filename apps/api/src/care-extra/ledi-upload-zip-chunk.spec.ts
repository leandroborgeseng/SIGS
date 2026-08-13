import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import JSZip from 'jszip';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { CareExtraController } from './care-extra.controller';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';
import { LediZipChunkService } from './ledi-zip-chunk.service';
import { JobsService } from '../infra/jobs/jobs.service';
import { StorageService } from '../infra/storage/storage.service';
import { applyHttpBodyParsers } from '../infra/http-body';

describe('PUT /v1/dental/ledi/batches/upload-zip/chunk', () => {
  let app: INestApplication;
  let tmp: string;
  const create = jest.fn();

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'ledi-chunk-http-'));
    process.env.LEDI_CHUNK_DIR = tmp;
    process.env.LEDI_CHUNK_SWEEP_MS = '0';

    const moduleRef = await Test.createTestingModule({
      controllers: [CareExtraController],
      providers: [
        { provide: CareExtraService, useValue: {} },
        { provide: LediFaoBatchService, useValue: { create } },
        { provide: JobsService, useValue: { enqueue: jest.fn() } },
        {
          provide: LediZipChunkService,
          useFactory: () => new LediZipChunkService({ root: tmp, sweepMs: 0 }),
        },
        {
          provide: StorageService,
          useValue: {
            put: jest.fn(),
            buildKey: (parts: string[]) => parts.join('/'),
          },
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
    await rm(tmp, { recursive: true, force: true });
  });

  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: 'batch-chunk', summary: { total: 1 } });
  });

  async function zipBuf(): Promise<Buffer> {
    const zip = new JSZip();
    zip.file(
      'sistemas/5974691/ficha.xml',
      '<tipoDadoSerializado>4</tipoDadoSerializado><fichaAtendimentoIndividualMasterTransport/>',
    );
    zip.file('__MACOSX/sistemas/._ficha.xml', '\u0000x');
    return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
  }

  it('monta ZIP de duas fatias octet-stream e ingere (pasta e-SUS + __MACOSX)', async () => {
    const buf = await zipBuf();
    const mid = Math.max(1, Math.floor(buf.length / 2));
    const a = buf.subarray(0, mid);
    const b = buf.subarray(mid);
    const uploadId = '11111111-2222-4333-8444-555555555555';
    const q = (index: number) =>
      `/v1/dental/ledi/batches/upload-zip/chunk?uploadId=${uploadId}&index=${index}&total=2&fileName=sistemas.zip&expectedTipo=FAI&name=sistemas&totalBytes=${buf.length}`;

    const r1 = await request(app.getHttpServer())
      .put(q(0))
      .set('Content-Type', 'application/octet-stream')
      .send(a);
    expect(r1.status).toBe(200);
    expect(r1.body.complete).toBe(false);
    expect(create).not.toHaveBeenCalled();

    const r2 = await request(app.getHttpServer())
      .put(q(1))
      .set('Content-Type', 'application/octet-stream')
      .send(b);
    expect(r2.status).toBeLessThan(400);
    expect(create).toHaveBeenCalledTimes(1);
    const dto = create.mock.calls[0]![0] as { expectedTipo: string; files: Array<{ name: string }> };
    expect(dto.expectedTipo).toBe('FAI');
    expect(dto.files[0]!.name).toBe('ficha.xml');
  });

  it('HTTP 400 se o chunk está vazio', async () => {
    const res = await request(app.getHttpServer())
      .put(
        '/v1/dental/ledi/batches/upload-zip/chunk?uploadId=11111111-2222-4333-8444-555555555555&index=0&total=1&totalBytes=4',
      )
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(0));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

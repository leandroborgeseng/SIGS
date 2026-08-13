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
import { LEDI_ZIP_CHUNK_BYTES } from './ledi-zip.limits';
import { JobsService } from '../infra/jobs/jobs.service';
import { StorageService } from '../infra/storage/storage.service';
import { applyHttpBodyParsers } from '../infra/http-body';

describe('POST /v1/dental/ledi/batches/upload-zip/chunk', () => {
  let app: INestApplication;
  let tmp: string;
  const create = jest.fn();
  const enqueue = jest.fn();
  const putFromFile = jest.fn();

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'ledi-chunk-http-'));
    process.env.LEDI_CHUNK_DIR = tmp;
    process.env.LEDI_CHUNK_SWEEP_MS = '0';

    const moduleRef = await Test.createTestingModule({
      controllers: [CareExtraController],
      providers: [
        { provide: CareExtraService, useValue: {} },
        { provide: LediFaoBatchService, useValue: { create } },
        { provide: JobsService, useValue: { enqueue } },
        {
          provide: LediZipChunkService,
          useFactory: () => new LediZipChunkService({ root: tmp, sweepMs: 0 }),
        },
        {
          provide: StorageService,
          useValue: {
            put: jest.fn(),
            putFromFile,
            tryLocalPath: jest.fn().mockReturnValue(null),
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
    enqueue.mockReset();
    enqueue.mockResolvedValue({ id: 'job-chunk', status: 'queued' });
    putFromFile.mockReset();
    putFromFile.mockResolvedValue({
      key: 'uploads/ledi-zip/x.zip',
      sha256: 'abc',
      size: 1,
      contentType: 'application/zip',
    });
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

  it('monta ZIP de duas fatias e enfileira análise (não extrai no HTTP)', async () => {
    const buf = await zipBuf();
    const mid = Math.max(1, Math.floor(buf.length / 2));
    const a = buf.subarray(0, mid);
    const b = buf.subarray(mid);
    const uploadId = '11111111-2222-4333-8444-555555555555';
    const q = (index: number) =>
      `/v1/dental/ledi/batches/upload-zip/chunk?uploadId=${uploadId}&index=${index}&total=2&fileName=sistemas.zip&expectedTipo=FAI&name=sistemas&totalBytes=${buf.length}`;

    const r1 = await request(app.getHttpServer())
      .post(q(0))
      .set('Content-Type', 'application/octet-stream')
      .send(a);
    expect(r1.status).toBe(200);
    expect(r1.body.complete).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();

    const r2 = await request(app.getHttpServer())
      .post(q(1))
      .set('Content-Type', 'application/octet-stream')
      .send(b);
    expect(r2.status).toBe(202);
    expect(r2.body.async).toBe(true);
    expect(r2.body.jobId).toBe('job-chunk');
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(putFromFile).toHaveBeenCalledTimes(1);
    const payload = enqueue.mock.calls[0]![0] as { payload: { expectedTipo: string } };
    expect(payload.payload.expectedTipo).toBe('FAI');
  });

  it('monta buffer sintético ~8 MB em fatias de 512 KiB e enfileira (sem ZIP de paciente)', async () => {
    const totalBytes = 8 * 1024 * 1024;
    const chunk = LEDI_ZIP_CHUNK_BYTES;
    const total = Math.ceil(totalBytes / chunk);
    const uploadId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const q = (index: number, len: number) =>
      `/v1/dental/ledi/batches/upload-zip/chunk?uploadId=${uploadId}&index=${index}&total=${total}&fileName=sintetico.zip&expectedTipo=FAI&totalBytes=${totalBytes}`;

    for (let i = 0; i < total; i++) {
      const start = i * chunk;
      const len = Math.min(chunk, totalBytes - start);
      const part = Buffer.alloc(len, 0x41);
      if (i === 0) {
        part[0] = 0x50;
        part[1] = 0x4b;
        part[2] = 0x03;
        part[3] = 0x04;
      }
      const res = await request(app.getHttpServer())
        .post(q(i, len))
        .set('Content-Type', 'application/octet-stream')
        .send(part);
      expect(res.status).toBeLessThan(400);
      if (i < total - 1) {
        expect(res.body.complete).toBe(false);
        expect(enqueue).not.toHaveBeenCalled();
      } else {
        expect(res.body.async).toBe(true);
        expect(enqueue).toHaveBeenCalledTimes(1);
        expect(putFromFile).toHaveBeenCalledTimes(1);
        const assembledPath = putFromFile.mock.calls[0]![1] as string;
        expect(assembledPath).toMatch(/assembled\.zip$/);
      }
    }
    expect(create).not.toHaveBeenCalled();
  }, 30_000);

  it('HTTP 400 se o chunk está vazio', async () => {
    const res = await request(app.getHttpServer())
      .post(
        '/v1/dental/ledi/batches/upload-zip/chunk?uploadId=11111111-2222-4333-8444-555555555555&index=0&total=1&totalBytes=4',
      )
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(0));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import JSZip from 'jszip';
import request from 'supertest';
import { CareExtraController } from './care-extra.controller';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';
import { JobsService } from '../infra/jobs/jobs.service';
import { applyHttpBodyParsers } from '../infra/http-body';

describe('POST /v1/dental/ledi/batches/upload-zip', () => {
  let app: INestApplication;
  const create = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CareExtraController],
      providers: [
        { provide: CareExtraService, useValue: {} },
        { provide: LediFaoBatchService, useValue: { create } },
        { provide: JobsService, useValue: {} },
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
    create.mockReset();
    create.mockResolvedValue({ id: 'batch-1', summary: { total: 1 } });
  });

  async function zipBuf(): Promise<Buffer> {
    const zip = new JSZip();
    zip.file('ficha.xml', '<tipoDadoSerializado>5</tipoDadoSerializado>');
    return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
  }

  it('aceita ZIP multipart (campo file) com json parser global ativo', async () => {
    const buf = await zipBuf();
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/upload-zip')
      .field('name', 'lote-teste')
      .field('expectedTipo', 'FAO')
      .attach('file', buf, 'lote.zip');

    expect(res.status).toBeLessThan(400);
    expect(create).toHaveBeenCalledTimes(1);
    const dto = create.mock.calls[0]![0] as { expectedTipo: string; files: Array<{ name: string }> };
    expect(dto.expectedTipo).toBe('FAO');
    expect(dto.files[0]!.name).toBe('ficha.xml');
  });

  it('HTTP 400 se o stream multipart acaba sem closing boundary', async () => {
    const boundary = '----TestBoundary';
    const truncated = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="lote.zip"\r\nContent-Type: application/zip\r\n\r\nPK\x03\x04incomplete`,
    );
    const res = await request(app.getHttpServer())
      .post('/v1/dental/ledi/batches/upload-zip')
      .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      .send(truncated);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body).toLowerCase()).toMatch(/unexpected end of form|multipart/);
    expect(create).not.toHaveBeenCalled();
  });
});

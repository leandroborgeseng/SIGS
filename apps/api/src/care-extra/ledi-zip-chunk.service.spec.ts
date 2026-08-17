import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { LediZipChunkService, resolveLediChunkDir } from './ledi-zip-chunk.service';
import { LEDI_ZIP_CHUNK_BYTES, LEDI_ZIP_MAX_BYTES } from './ledi-zip.limits';

function uuid(): string {
  return 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
}

describe('LediZipChunkService', () => {
  let dir: string;
  let svc: LediZipChunkService;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ledi-chunk-'));
    svc = new LediZipChunkService({ root: dir, sweepMs: 0, ttlMs: 50 });
    await svc.onModuleInit();
  });

  afterEach(async () => {
    svc.onModuleDestroy();
    await rm(dir, { recursive: true, force: true });
  });

  it('grava fatias em disco e monta o ZIP só quando completo', async () => {
    const uploadId = uuid();
    const a = Buffer.from('PK\x03\x04AAAA');
    const b = Buffer.from('BBBB');
    const totalBytes = a.length + b.length;

    const first = await svc.acceptChunk({
      uploadId,
      index: 0,
      total: 2,
      body: a,
      fileName: 'sistemas.zip',
      expectedTipo: 'FAI',
      name: 'sistemas',
      totalBytes,
    });
    expect(first.complete).toBe(false);
    if (!first.complete) expect(first.received).toBe(1);

    const second = await svc.acceptChunk({
      uploadId,
      index: 1,
      total: 2,
      body: b,
      fileName: 'sistemas.zip',
      expectedTipo: 'FAI',
      name: 'sistemas',
      totalBytes,
    });
    expect(second.complete).toBe(true);
    if (!second.complete) return;
    const assembled = await svc.readAssembled(second.assembledPath);
    expect(assembled.equals(Buffer.concat([a, b]))).toBe(true);
    expect(assembled.subarray(0, 2).toString()).toBe('PK');
    expect(second.expectedTipo).toBe('FAI');

    await svc.cleanup(uploadId);
    await expect(svc.readAssembled(second.assembledPath)).rejects.toThrow();
  });

  it('preserva expectedTipo CADASTRO_INDIVIDUAL (não colapsa em FAO)', async () => {
    const uploadId = 'cccccccc-dddd-4eee-8fff-000000000000';
    const a = Buffer.from('PK\x03\x04CI');
    const done = await svc.acceptChunk({
      uploadId,
      index: 0,
      total: 1,
      body: a,
      fileName: 'cad-ind.zip',
      expectedTipo: 'CADASTRO_INDIVIDUAL',
      name: 'cad-ind',
      totalBytes: a.length,
    });
    expect(done.complete).toBe(true);
    if (!done.complete) return;
    expect(done.expectedTipo).toBe('CADASTRO_INDIVIDUAL');
  });

  it('rejeita uploadId com path traversal', async () => {
    await expect(
      svc.acceptChunk({
        uploadId: '../evil',
        index: 0,
        total: 1,
        body: Buffer.from('PK\x03\x04'),
      }),
    ).rejects.toThrow(/uploadId inválido/);
  });

  it('remove tmp órfão após TTL', async () => {
    const uploadId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
    await svc.acceptChunk({
      uploadId,
      index: 0,
      total: 2,
      body: Buffer.from('PK\x03\x04xx'),
      totalBytes: 100,
    });
    const removed = await svc.sweep(Date.now() + 1_000);
    expect(removed).toBe(1);
  });

  it('resolveLediChunkDir usa volume quando PROCESS_ROLE=all', () => {
    expect(
      resolveLediChunkDir({
        PROCESS_ROLE: 'all',
        STORAGE_LOCAL_PATH: '/data/storage',
      }),
    ).toBe('/data/ledi-chunks');
    expect(resolveLediChunkDir({ LEDI_CHUNK_DIR: '/custom' })).toBe('/custom');
    expect(resolveLediChunkDir({ PROCESS_ROLE: 'api' })).toMatch(/sigs-ledi-chunks$/);
  });

  it('monta ~8 MB sintético em fatias de 512 KiB (sem ZIP de paciente)', async () => {
    const uploadId = uuid();
    const totalBytes = 8 * 1024 * 1024;
    const chunk = LEDI_ZIP_CHUNK_BYTES;
    const total = Math.ceil(totalBytes / chunk);
    let last: Awaited<ReturnType<LediZipChunkService['acceptChunk']>> | undefined;
    for (let i = 0; i < total; i++) {
      const start = i * chunk;
      const len = Math.min(chunk, totalBytes - start);
      const body = Buffer.alloc(len, 0x41);
      if (i === 0) {
        body[0] = 0x50;
        body[1] = 0x4b;
        body[2] = 0x03;
        body[3] = 0x04;
      }
      last = await svc.acceptChunk({
        uploadId,
        index: i,
        total,
        body,
        totalBytes,
        fileName: 'sintetico.zip',
      });
    }
    expect(last?.complete).toBe(true);
    if (!last?.complete) return;
    const assembled = await svc.readAssembled(last.assembledPath);
    expect(assembled.length).toBe(totalBytes);
    expect(assembled.subarray(0, 2).toString()).toBe('PK');
    expect(LEDI_ZIP_MAX_BYTES).toBe(100 * 1024 * 1024);
  });
});

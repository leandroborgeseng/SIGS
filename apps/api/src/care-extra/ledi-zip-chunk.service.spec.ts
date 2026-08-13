import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { LediZipChunkService } from './ledi-zip-chunk.service';

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

    await svc.cleanup(uploadId);
    await expect(svc.readAssembled(second.assembledPath)).rejects.toThrow();
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
});

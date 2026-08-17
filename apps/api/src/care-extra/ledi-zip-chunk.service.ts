/**
 * Junta fatias octet-stream do ZIP LEDI em disco (não em RAM).
 * O gateway Railway / proxy público corta multipart grande; a UI envia 512 KiB.
 */
import { BadRequestException, Inject, Injectable, Logger, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile, appendFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { LEDI_ZIP_MAX_BYTES, LEDI_ZIP_MAX_CHUNKS } from './ledi-zip.limits';
import { parseLediLoteTipo, type LediLoteTipo } from './ledi-ficha-tipo';

export const LEDI_CHUNK_OPTIONS = 'LEDI_CHUNK_OPTIONS';

export type LediZipChunkOptions = {
  root?: string;
  maxChunkBytes?: number;
  maxTotalBytes?: number;
  ttlMs?: number;
  sweepMs?: number;
};

const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PROCESS_ROLE=all: tmp no volume (/data/ledi-chunks). Senão os.tmpdir(). */
export function resolveLediChunkDir(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.LEDI_CHUNK_DIR?.trim();
  if (explicit) return explicit;
  if (env.PROCESS_ROLE === 'all' && env.STORAGE_LOCAL_PATH) {
    return path.join(path.dirname(env.STORAGE_LOCAL_PATH), 'ledi-chunks');
  }
  return path.join(os.tmpdir(), 'sigs-ledi-chunks');
}

export type LediZipChunkMeta = {
  createdAt: number;
  total: number;
  totalBytes: number;
  fileName: string;
  expectedTipo: LediLoteTipo;
  name?: string;
};

export type LediZipChunkProgress = {
  complete: false;
  uploadId: string;
  received: number;
  total: number;
  index: number;
};

export type LediZipChunkComplete = {
  complete: true;
  uploadId: string;
  received: number;
  total: number;
  assembledPath: string;
  name?: string;
  expectedTipo: LediLoteTipo;
  fileName: string;
};

export type LediZipChunkResult = LediZipChunkProgress | LediZipChunkComplete;

function asTipo(v?: string): LediLoteTipo {
  return parseLediLoteTipo(v);
}

@Injectable()
export class LediZipChunkService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LediZipChunkService.name);
  private readonly root: string;
  private readonly maxChunkBytes: number;
  private readonly maxTotalBytes: number;
  private readonly ttlMs: number;
  private readonly sweepMs: number;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(@Optional() @Inject(LEDI_CHUNK_OPTIONS) opts?: LediZipChunkOptions) {
    this.root = opts?.root || resolveLediChunkDir();
    this.maxChunkBytes = opts?.maxChunkBytes ?? Number(process.env.LEDI_CHUNK_MAX_BYTES || 2.5 * 1024 * 1024);
    this.maxTotalBytes = opts?.maxTotalBytes ?? Number(process.env.LEDI_CHUNK_MAX_TOTAL || LEDI_ZIP_MAX_BYTES);
    this.ttlMs = opts?.ttlMs ?? Number(process.env.LEDI_CHUNK_TTL_MS || 2 * 60 * 60 * 1000);
    this.sweepMs = opts?.sweepMs ?? Number(process.env.LEDI_CHUNK_SWEEP_MS ?? 15 * 60 * 1000);
  }

  async onModuleInit() {
    await mkdir(this.root, { recursive: true });
    if (this.sweepMs > 0) {
      this.sweepTimer = setInterval(() => {
        this.sweep().catch((err) =>
          this.log.warn(`sweep chunks: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, this.sweepMs);
      this.sweepTimer.unref?.();
    }
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  dirFor(uploadId: string): string {
    this.assertUploadId(uploadId);
    return path.join(this.root, uploadId);
  }

  async acceptChunk(input: {
    uploadId: string;
    index: number;
    total: number;
    body: Buffer;
    fileName?: string;
    expectedTipo?: string;
    name?: string;
    totalBytes?: number;
  }): Promise<LediZipChunkResult> {
    this.assertUploadId(input.uploadId);
    const index = Number(input.index);
    const total = Number(input.total);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total < 1 || index >= total) {
      throw new BadRequestException('índice/total de chunk inválido');
    }
    if (total > LEDI_ZIP_MAX_CHUNKS) {
      throw new BadRequestException(`ZIP em demasiadas partes (${total}; máx. ${LEDI_ZIP_MAX_CHUNKS}).`);
    }
    const body = input.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException('Chunk vazio — envie application/octet-stream com bytes.');
    }
    if (body.length > this.maxChunkBytes) {
      throw new BadRequestException(
        `Chunk ${index} tem ${body.length} bytes; o limite por parte é ${this.maxChunkBytes}.`,
      );
    }
    const totalBytes = Number(input.totalBytes || 0);
    if (totalBytes && (totalBytes < 1 || totalBytes > this.maxTotalBytes)) {
      throw new BadRequestException(
        `ZIP tem ${totalBytes} bytes; o limite é ${this.maxTotalBytes}.`,
      );
    }

    const dir = this.dirFor(input.uploadId);
    await mkdir(dir, { recursive: true });

    const metaPath = path.join(dir, 'meta.json');
    let meta = await this.readMeta(metaPath);
    if (!meta) {
      meta = {
        createdAt: Date.now(),
        total,
        totalBytes: totalBytes || 0,
        fileName: (input.fileName || 'lote.zip').slice(0, 255),
        expectedTipo: asTipo(input.expectedTipo),
        name: input.name,
      };
      await writeFile(metaPath, JSON.stringify(meta), 'utf8');
    } else {
      if (meta.total !== total) {
        throw new BadRequestException('total de chunks não bate com o início deste upload');
      }
      if (totalBytes && meta.totalBytes && meta.totalBytes !== totalBytes) {
        throw new BadRequestException('totalBytes não bate com o início deste upload');
      }
    }

    const assembledPath = path.join(dir, 'assembled.zip');
    if (await this.exists(assembledPath)) {
      return {
        complete: true,
        uploadId: input.uploadId,
        received: total,
        total,
        assembledPath,
        name: meta.name,
        expectedTipo: meta.expectedTipo,
        fileName: meta.fileName,
      };
    }

    const partPath = path.join(dir, String(index));
    await writeFile(partPath, body);

    const received = await this.countParts(dir, total);
    this.log.log(
      `chunk ${index + 1}/${total} ${body.length}B uploadId=${input.uploadId} received=${received} complete=${received >= total}`,
    );
    if (received < total) {
      return {
        complete: false,
        uploadId: input.uploadId,
        received,
        total,
        index,
      };
    }

    await this.assemble(dir, total, assembledPath, meta.totalBytes || totalBytes);
    return {
      complete: true,
      uploadId: input.uploadId,
      received: total,
      total,
      assembledPath,
      name: meta.name,
      expectedTipo: meta.expectedTipo,
      fileName: meta.fileName,
    };
  }

  async readAssembled(assembledPath: string): Promise<Buffer> {
    const buf = await readFile(assembledPath);
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      throw new BadRequestException('ZIP montado inválido (não começa com PK). Chegou truncado?');
    }
    return buf;
  }

  async cleanup(uploadId: string): Promise<void> {
    try {
      this.assertUploadId(uploadId);
    } catch {
      return;
    }
    await rm(this.dirFor(uploadId), { recursive: true, force: true });
  }

  async sweep(now = Date.now()): Promise<number> {
    let removed = 0;
    let names: string[] = [];
    try {
      names = await readdir(this.root);
    } catch {
      return 0;
    }
    for (const name of names) {
      if (!UPLOAD_ID_RE.test(name)) continue;
      const dir = path.join(this.root, name);
      try {
        const meta = await this.readMeta(path.join(dir, 'meta.json'));
        const created = meta?.createdAt ?? (await stat(dir)).mtimeMs;
        if (now - created > this.ttlMs) {
          await rm(dir, { recursive: true, force: true });
          removed += 1;
        }
      } catch (err) {
        this.log.warn(`sweep ${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (removed) this.log.log(`chunks órfãos removidos: ${removed}`);
    return removed;
  }

  private assertUploadId(id: string) {
    if (!UPLOAD_ID_RE.test(id)) {
      throw new BadRequestException('uploadId inválido');
    }
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await stat(p);
      return true;
    } catch {
      return false;
    }
  }

  private async readMeta(p: string): Promise<LediZipChunkMeta | null> {
    try {
      const raw = await readFile(p, 'utf8');
      return JSON.parse(raw) as LediZipChunkMeta;
    } catch {
      return null;
    }
  }

  private async countParts(dir: string, total: number): Promise<number> {
    let n = 0;
    for (let i = 0; i < total; i++) {
      if (await this.exists(path.join(dir, String(i)))) n += 1;
    }
    return n;
  }

  private async assemble(dir: string, total: number, dest: string, expectedBytes: number) {
    const lock = path.join(dir, '.assembling');
    try {
      await writeFile(lock, String(Date.now()), { flag: 'wx' });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') {
        // Outra request está montando; espera o assembled.zip aparecer.
        for (let i = 0; i < 50; i++) {
          if (await this.exists(dest)) return;
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new BadRequestException('Timeout ao montar ZIP a partir dos chunks.');
      }
      throw e;
    }

    const tmp = `${dest}.partial`;
    await writeFile(tmp, Buffer.alloc(0));
    let size = 0;
    try {
      for (let i = 0; i < total; i++) {
        const partBuf = await readFile(path.join(dir, String(i)));
        size += partBuf.length;
        if (size > this.maxTotalBytes) {
          throw new BadRequestException(`ZIP montado excede ${this.maxTotalBytes} bytes.`);
        }
        await appendFile(tmp, partBuf);
      }
      if (expectedBytes && size !== expectedBytes) {
        throw new BadRequestException(
          `ZIP montado tem ${size} bytes; o cliente declarou ${expectedBytes}.`,
        );
      }
      await rename(tmp, dest);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      await unlink(lock).catch(() => undefined);
      throw err;
    }
  }
}

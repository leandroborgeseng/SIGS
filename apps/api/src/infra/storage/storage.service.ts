import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'fs/promises';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';

export type StoredObject = {
  key: string;
  sha256: string;
  size: number;
  contentType: string;
};

/**
 * Object Storage S3-compatible (MinIO/R2/S3) com fallback local em disco
 * apenas para desenvolvimento single-node.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  private readonly driver: 's3' | 'local';
  private readonly bucket: string;
  private readonly localRoot: string;
  private s3: S3Client | null = null;

  constructor() {
    const raw = (process.env.STORAGE_DRIVER || '').toLowerCase();
    const hasS3 =
      !!process.env.S3_ENDPOINT ||
      !!process.env.AWS_ACCESS_KEY_ID ||
      !!process.env.S3_ACCESS_KEY;
    this.driver = raw === 's3' || (raw !== 'local' && hasS3) ? 's3' : 'local';
    this.bucket = process.env.S3_BUCKET || 'sigs';
    this.localRoot = process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'tmp', 'storage');
  }

  async onModuleInit() {
    if (this.driver === 's3') {
      this.s3 = new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || 'minio',
          secretAccessKey:
            process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'minio123',
        },
      });
      await this.ensureBucket();
      this.log.log(`Storage driver=s3 bucket=${this.bucket}`);
    } else {
      await mkdir(this.localRoot, { recursive: true });
      this.log.warn(
        `Storage driver=local path=${this.localRoot} (não use multi-réplica API com este modo)`,
      );
    }
  }

  getDriver() {
    return this.driver;
  }

  private async ensureBucket() {
    if (!this.s3) return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (err) {
        this.log.warn(`Bucket ensure: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  buildKey(parts: string[]) {
    return parts
      .map((p) => p.replace(/^\/+|\/+$/g, '').replace(/\.\./g, ''))
      .filter(Boolean)
      .join('/');
  }

  async put(
    key: string,
    body: Buffer | string,
    contentType = 'application/octet-stream',
  ): Promise<StoredObject> {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (this.driver === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buf,
          ContentType: contentType,
          Metadata: { sha256 },
        }),
      );
    } else {
      const full = path.join(this.localRoot, key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, buf);
    }
    return { key, sha256, size: buf.length, contentType };
  }

  /** Path absoluto no disco local, ou null se o driver for S3. */
  tryLocalPath(key: string): string | null {
    if (this.driver !== 'local') return null;
    return path.join(this.localRoot, key);
  }

  private hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', (c) => hash.update(c));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /** Copia arquivo em disco para o storage sem Buffer na RAM (ZIP 13–100 MB). */
  async putFromFile(
    key: string,
    filePath: string,
    contentType = 'application/octet-stream',
  ): Promise<StoredObject> {
    const st = await stat(filePath);
    const sha256 = await this.hashFile(filePath);
    if (this.driver === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: createReadStream(filePath),
          ContentType: contentType,
          ContentLength: st.size,
          Metadata: { sha256 },
        }),
      );
    } else {
      const full = path.join(this.localRoot, key);
      await mkdir(path.dirname(full), { recursive: true });
      await copyFile(filePath, full);
    }
    return { key, sha256, size: st.size, contentType };
  }

  async getBuffer(key: string): Promise<Buffer> {
    if (this.driver === 's3' && this.s3) {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await out.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Objeto vazio: ${key}`);
      return Buffer.from(bytes);
    }
    return readFile(path.join(this.localRoot, key));
  }

  async getText(key: string): Promise<string> {
    return (await this.getBuffer(key)).toString('utf8');
  }

  async putXml(scope: string, id: string, xml: string) {
    const key = this.buildKey(['ledi', scope, id, `${randomUUID()}.xml`]);
    return this.put(key, xml, 'application/xml');
  }

  async signedGetUrl(key: string, expiresIn = 900): Promise<string | null> {
    if (this.driver !== 's3' || !this.s3) return null;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }
}

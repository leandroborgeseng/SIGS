import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { ModuleRef } from '@nestjs/core';

export const JOB_NAMES = {
  LEDI_AUTO_FIX: 'ledi.auto-fix',
  LEDI_EXPORT_ZIP: 'ledi.export-zip',
  SIGTAP_IMPORT: 'sigtap.import',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

type JobPayload = Record<string, unknown> & { jobRunId: string };

type Processor = (payload: JobPayload) => Promise<Record<string, unknown>>;

/**
 * BullMQ quando REDIS_URL está definido; senão executa inline (dev single-node).
 * Produção: API enfileira + workers separados consomem.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(QueueService.name);
  private readonly redisUrl = process.env.REDIS_URL || '';
  private connection: ConnectionOptions | null = null;
  private queues = new Map<string, Queue>();
  private workers: Worker[] = [];
  private processors = new Map<string, Processor>();
  private inline = true;

  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    if (!this.redisUrl) {
      this.inline = true;
      this.log.warn('REDIS_URL ausente — fila inline no processo da API (não escala horizontalmente)');
      return;
    }
    this.inline = false;
    this.connection = { url: this.redisUrl };
    for (const name of Object.values(JOB_NAMES)) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
    this.log.log(`Queue broker Redis OK · filas: ${[...this.queues.keys()].join(', ')}`);
  }

  async onModuleDestroy() {
    for (const w of this.workers) await w.close();
    for (const q of this.queues.values()) await q.close();
  }

  isInline() {
    return this.inline;
  }

  registerProcessor(name: JobName | string, fn: Processor) {
    this.processors.set(name, fn);
  }

  /** Chamado pelo worker.main para consumir filas. */
  async startWorkers() {
    if (this.inline || !this.connection) {
      this.log.warn('startWorkers ignorado (modo inline)');
      return;
    }
    for (const name of Object.values(JOB_NAMES)) {
      const worker = new Worker(
        name,
        async (job: Job) => {
          const fn = this.processors.get(name);
          if (!fn) throw new Error(`Sem processor para ${name}`);
          return fn(job.data as JobPayload);
        },
        {
          connection: this.connection,
          concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
        },
      );
      worker.on('failed', (job, err) => {
        this.log.error(`Job ${name} failed ${job?.id}: ${err.message}`);
      });
      this.workers.push(worker);
    }
    this.log.log(`Workers ativos: ${this.workers.length}`);
  }

  async enqueue(name: JobName | string, payload: JobPayload) {
    if (this.inline) {
      setImmediate(() => {
        void this.runInline(name, payload);
      });
      return { mode: 'inline' as const };
    }
    const q = this.queues.get(name);
    if (!q) throw new Error(`Fila desconhecida: ${name}`);
    await q.add(name, payload, {
      jobId: payload.jobRunId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return { mode: 'queued' as const };
  }

  private async runInline(name: string, payload: JobPayload) {
    const fn = this.processors.get(name);
    if (!fn) {
      this.log.error(`Inline: sem processor ${name}`);
      return;
    }
    try {
      await fn(payload);
    } catch (err) {
      this.log.error(
        `Inline job ${name} falhou: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

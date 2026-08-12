import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getRequestContext } from '../request-context';
import { QueueService, JOB_NAMES, type JobName } from '../queue/queue.service';

export type EnqueueJobInput = {
  type: JobName | string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
};

@Injectable()
export class JobsService {
  private readonly log = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async enqueue(input: EnqueueJobInput) {
    const ctx = getRequestContext();
    if (input.idempotencyKey) {
      const existing = await this.prisma.jobRun.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing && ['queued', 'active', 'completed'].includes(existing.status)) {
        return existing;
      }
    }

    const job = await this.prisma.jobRun.create({
      data: {
        type: input.type,
        status: 'queued',
        idempotencyKey: input.idempotencyKey,
        correlationId: ctx?.correlationId,
        userId: ctx?.userId,
        payloadJson: JSON.stringify(input.payload),
        maxAttempts: input.maxAttempts ?? 5,
      },
    });

    await this.queue.enqueue(input.type as JobName, {
      jobRunId: job.id,
      ...input.payload,
    });

    this.log.log(`Job enqueued ${job.type} id=${job.id}`);
    return job;
  }

  async get(id: string) {
    const job = await this.prisma.jobRun.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job não encontrado');
    return this.serialize(job);
  }

  async markActive(id: string) {
    return this.prisma.jobRun.update({
      where: { id },
      data: {
        status: 'active',
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async markProgress(id: string, pct: number, message?: string) {
    return this.prisma.jobRun.update({
      where: { id },
      data: {
        progressPct: Math.max(0, Math.min(100, pct)),
        progressMessage: message,
      },
    });
  }

  async markCompleted(id: string, result: Record<string, unknown>, resultObjectKey?: string) {
    return this.prisma.jobRun.update({
      where: { id },
      data: {
        status: 'completed',
        progressPct: 100,
        resultJson: JSON.stringify(result),
        resultObjectKey,
        finishedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async markFailed(id: string, error: string, dead = false) {
    const job = await this.prisma.jobRun.findUnique({ where: { id } });
    const attempts = job?.attempts ?? 0;
    const max = job?.maxAttempts ?? 5;
    const status = dead || attempts >= max ? 'dead' : 'failed';
    return this.prisma.jobRun.update({
      where: { id },
      data: {
        status,
        errorMessage: error.slice(0, 2000),
        finishedAt: status === 'dead' ? new Date() : undefined,
      },
    });
  }

  serialize(job: {
    id: string;
    type: string;
    status: string;
    idempotencyKey: string | null;
    correlationId: string | null;
    payloadJson: string;
    resultJson: string | null;
    errorMessage: string | null;
    attempts: number;
    maxAttempts: number;
    progressPct: number;
    progressMessage: string | null;
    resultObjectKey: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      idempotencyKey: job.idempotencyKey,
      correlationId: job.correlationId,
      payload: JSON.parse(job.payloadJson || '{}'),
      result: job.resultJson ? JSON.parse(job.resultJson) : null,
      errorMessage: job.errorMessage,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      progressPct: job.progressPct,
      progressMessage: job.progressMessage,
      resultObjectKey: job.resultObjectKey,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /** Tipos conhecidos (documentação / UI). */
  static readonly TYPES = JOB_NAMES;
}

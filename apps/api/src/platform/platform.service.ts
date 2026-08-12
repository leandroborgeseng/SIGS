import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { StorageService } from '../infra/storage/storage.service';
import { QueueService } from '../infra/queue/queue.service';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  health() {
    return {
      status: 'ok',
      version: '0.4.0-dev',
      phase: 'rewrite-scale-foundation',
      ui: 'next-claude-design-mvp',
      stack: 'nestjs+prisma+postgres+redis+s3',
      database: 'postgresql',
      storage: this.storage.getDriver(),
      queue: this.queue.isInline() ? 'inline' : 'redis-bullmq',
    };
  }

  async readiness() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = { ok: true };
    } catch (err) {
      checks.postgres = {
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
    checks.storage = { ok: true, detail: this.storage.getDriver() };
    checks.queue = {
      ok: true,
      detail: this.queue.isInline() ? 'inline' : 'redis',
    };
    const ready = Object.values(checks).every((c) => c.ok);
    return { status: ready ? 'ready' : 'not_ready', checks };
  }

  anchors() {
    return Object.values(RF).map((r) => ({
      id: r.id,
      tipo: r.tipo,
      fonte: r.fonte,
      teste_faturamento: r.teste_faturamento,
      nota: 'nota' in r ? r.nota : '',
    }));
  }

  async audit(limit = 100) {
    const rows = await this.prisma.auditEvent.findMany({
      orderBy: { at: 'desc' },
      take: limit,
    });
    return rows.map((e) => ({
      id: e.id,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      userId: e.userId,
      correlationId: e.correlationId,
      ip: e.ip,
      outcome: e.outcome,
      rfIds: e.rfIdsCsv ? e.rfIdsCsv.split(',') : [],
      detail: JSON.parse(e.detailJson || '{}'),
      at: e.at,
    }));
  }
}

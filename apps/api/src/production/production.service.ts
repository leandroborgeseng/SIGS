import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import {
  EnqueueBatchDto,
  MarkErrorDto,
  MarkSentDto,
  ReprocessDto,
  SendProductionDto,
} from './dto';
import { buildBpaStub } from './bpa-stub.mapper';
import { buildPreflightReport, validateBatch } from './preflight.validator';
import { SigtapService } from '../sigtap/sigtap.service';
import { assertTransition, BatchStatus } from './lifecycle';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sigtap: SigtapService,
  ) {}

  list(status?: string) {
    return this.prisma.productionBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const row = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lote não encontrado');
    return this.decorate(row);
  }

  private decorate(row: {
    id: string;
    kind: string;
    status: string;
    rfIdsCsv: string;
    payloadJson: string;
    errorMessage?: string | null;
    statusChangedAt?: Date | null;
    createdAt: Date;
  }) {
    return {
      ...row,
      rfIds: row.rfIdsCsv ? row.rfIdsCsv.split(',') : [],
      payload: JSON.parse(row.payloadJson || '{}'),
    };
  }

  private async setStatus(
    id: string,
    from: string,
    to: BatchStatus,
    extra?: { errorMessage?: string | null },
  ) {
    try {
      assertTransition(from, to);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return this.prisma.productionBatch.update({
      where: { id },
      data: {
        status: to,
        statusChangedAt: new Date(),
        errorMessage: to === 'error' ? extra?.errorMessage ?? null : null,
      },
    });
  }

  async enqueue(dto: EnqueueBatchDto) {
    const rfIds = dto.rfIds?.length ? dto.rfIds : [RF.ESUS.id, RF.PROD.id];
    const status = (dto.status || 'ready') as BatchStatus;
    const row = await this.prisma.productionBatch.create({
      data: {
        kind: dto.kind,
        status,
        rfIdsCsv: rfIds.join(','),
        payloadJson: JSON.stringify(dto.payload),
        statusChangedAt: new Date(),
      },
    });
    await this.prisma.audit('enqueue', 'production_batch', row.id, rfIds, {
      kind: dto.kind,
      status,
    });
    return this.decorate(row);
  }

  private async sigtapKnownMap(codes: string[]) {
    const unique = [...new Set(codes.filter(Boolean))];
    if (!unique.length) return {} as Record<string, boolean>;
    const enrichment = await this.sigtap.enrichProcedureCodes(unique);
    const map: Record<string, boolean> = {};
    for (const code of unique) {
      map[code] = !!enrichment[code]?.known;
    }
    return map;
  }

  private stubCodes() {
    return ['0301010064', '0301010030', '0101020010', '0101040024', '0101050011'];
  }

  async preflight(opts?: { competencia?: string; status?: string }) {
    const statuses = opts?.status ? [opts.status] : ['ready'];
    const rows = await this.prisma.productionBatch.findMany({
      where: { status: { in: statuses } },
      orderBy: { createdAt: 'asc' },
    });

    const sigtapKnown = await this.sigtapKnownMap(this.stubCodes());

    const report = buildPreflightReport(rows, {
      competencia: opts?.competencia,
      statuses,
      sigtapKnown,
      rfIds: [RF.PROD.id, RF.BPA.id, RF.BILLING_AMB.id, RF.SIGTAP_VALIDATE.id, RF.ESUS.id],
    });

    await this.prisma.audit('preflight', 'production_batch', 'aggregate', report.rfIds, {
      competencia: report.competencia,
      batches: report.totals.batches,
      blockers: report.totals.blockers,
      moneyRisks: report.totals.moneyRisks,
      canSend: report.totals.canSend,
    });

    return report;
  }

  async markSent(id: string, dto: MarkSentDto = {}) {
    const row = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lote não encontrado');
    if (row.status === 'sent') {
      return { ...this.decorate(row), forced: false };
    }

    const sigtapKnown = await this.sigtapKnownMap(this.stubCodes());
    const isolated = validateBatch(row, { sigtapKnown });

    if (isolated.blockers > 0 && !dto.force) {
      throw new BadRequestException({
        message: 'Envio bloqueado: corrija as estruturas ou use force=true com ciência do gestor.',
        preflight: isolated,
        canSend: false,
      });
    }

    const updated = await this.setStatus(id, row.status, 'sent');
    const rfIds = row.rfIdsCsv ? row.rfIdsCsv.split(',') : [];
    await this.prisma.audit('mark_sent', 'production_batch', id, rfIds, {
      force: !!dto.force,
      blockers: isolated.blockers,
      moneyRisks: isolated.moneyRisks,
    });
    return {
      ...this.decorate(updated),
      preflight: isolated,
      forced: !!dto.force,
    };
  }

  async markError(id: string, dto: MarkErrorDto = {}) {
    const row = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lote não encontrado');
    const message = dto.message?.trim() || 'Marcado como erro manualmente';
    const updated = await this.setStatus(id, row.status, 'error', { errorMessage: message });
    const rfIds = row.rfIdsCsv ? row.rfIdsCsv.split(',') : [];
    await this.prisma.audit('mark_error', 'production_batch', id, rfIds, { message });
    return this.decorate(updated);
  }

  /**
   * Revalida o lote (error/draft/ready).
   * Sem BLOCKER → ready; com BLOCKER → error (se markErrorIfBlocked).
   */
  async reprocess(id: string, dto: ReprocessDto = {}) {
    const row = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lote não encontrado');
    if (row.status === 'sent') {
      throw new BadRequestException('Lote já enviado — use reopen antes de reprocessar');
    }

    const sigtapKnown = await this.sigtapKnownMap(this.stubCodes());
    const isolated = validateBatch(row, { sigtapKnown });
    const markErrorIfBlocked = dto.markErrorIfBlocked !== false;
    const rfIds = row.rfIdsCsv ? row.rfIdsCsv.split(',') : [];

    if (isolated.blockers > 0) {
      const msg = isolated.findings
        .filter((f) => f.severity === 'BLOCKER')
        .map((f) => f.message)
        .slice(0, 5)
        .join(' · ');
      if (markErrorIfBlocked) {
        const updated = await this.setStatus(id, row.status, 'error', {
          errorMessage: msg || 'Bloqueios no pré-envio',
        });
        await this.prisma.audit('reprocess_error', 'production_batch', id, rfIds, {
          blockers: isolated.blockers,
        });
        return {
          ...this.decorate(updated),
          preflight: isolated,
          outcome: 'error' as const,
        };
      }
      return {
        ...this.decorate(row),
        preflight: isolated,
        outcome: 'blocked' as const,
      };
    }

    const updated = await this.setStatus(id, row.status, 'ready');
    await this.prisma.audit('reprocess_ready', 'production_batch', id, rfIds, {
      moneyRisks: isolated.moneyRisks,
    });
    return {
      ...this.decorate(updated),
      preflight: isolated,
      outcome: 'ready' as const,
    };
  }

  /** sent → ready (reabertura local; não “desenvia” SISAB real). */
  async reopen(id: string) {
    const row = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lote não encontrado');
    const updated = await this.setStatus(id, row.status, 'ready');
    const rfIds = row.rfIdsCsv ? row.rfIdsCsv.split(',') : [];
    await this.prisma.audit('reopen', 'production_batch', id, rfIds, {});
    return this.decorate(updated);
  }

  /** draft → ready com validação (ou error se bloqueado). */
  async promote(id: string) {
    const row = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lote não encontrado');
    if (row.status !== 'draft' && row.status !== 'error') {
      throw new BadRequestException('Só rascunho ou erro podem ser promovidos via promote; use reprocess');
    }
    return this.reprocess(id, { markErrorIfBlocked: true });
  }

  async send(dto: SendProductionDto = {}) {
    const report = await this.preflight({
      competencia: dto.competencia,
      status: 'ready',
    });

    let targets = report.batches;
    if (dto.batchIds?.length) {
      const set = new Set(dto.batchIds);
      targets = targets.filter((b) => set.has(b.batchId));
    }

    if (!targets.length) {
      throw new BadRequestException({
        message: 'Nenhum lote pronto para envio no filtro informado.',
        preflight: report,
      });
    }

    const blocked = targets.filter((b) => b.blockers > 0);
    const blockers = blocked.reduce((s, b) => s + b.blockers, 0);

    if (blockers > 0 && !dto.force) {
      if (dto.markBlockedAsError) {
        const now = new Date();
        for (const b of blocked) {
          const msg = b.findings
            .filter((f) => f.severity === 'BLOCKER')
            .map((f) => f.message)
            .slice(0, 3)
            .join(' · ');
          await this.prisma.productionBatch.update({
            where: { id: b.batchId },
            data: {
              status: 'error',
              errorMessage: msg || 'Bloqueio no envio',
              statusChangedAt: now,
            },
          });
        }
        await this.prisma.audit(
          'send_mark_errors',
          'production_batch',
          'aggregate',
          report.rfIds,
          { count: blocked.length },
        );
      }
      throw new BadRequestException({
        message:
          'Envio da produção bloqueado. Há estruturas faltando ou inválidas — veja o relatório preflight.',
        markedAsError: dto.markBlockedAsError ? blocked.map((b) => b.batchId) : [],
        preflight: {
          ...report,
          batches: targets,
          totals: {
            ...report.totals,
            batches: targets.length,
            blockers,
            canSend: false,
          },
        },
        canSend: false,
      });
    }

    const toSend = dto.force ? targets : targets.filter((b) => b.blockers === 0);
    const ids = toSend.map((b) => b.batchId);
    const now = new Date();
    await this.prisma.productionBatch.updateMany({
      where: { id: { in: ids } },
      data: { status: 'sent', statusChangedAt: now, errorMessage: null },
    });

    await this.prisma.audit('send_production', 'production_batch', 'aggregate', report.rfIds, {
      competencia: dto.competencia,
      count: ids.length,
      force: !!dto.force,
      blockers,
      moneyRisks: targets.reduce((s, b) => s + b.moneyRisks, 0),
    });

    return {
      sent: ids.length,
      batchIds: ids,
      forced: !!dto.force,
      preflight: {
        ...report,
        batches: targets,
        totals: {
          ...report.totals,
          batches: targets.length,
          blockers,
          canSend: blockers === 0,
        },
      },
    };
  }

  async exportBpa(competencia?: string, status?: string, opts?: { requirePreflightOk?: boolean }) {
    if (opts?.requirePreflightOk) {
      const report = await this.preflight({ competencia, status: status || 'ready' });
      if (!report.totals.canSend) {
        throw new BadRequestException({
          message: 'Export BPA bloqueado até corrigir bloqueios do pré-envio.',
          preflight: report,
        });
      }
    }

    const rows = await this.prisma.productionBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    const exported = buildBpaStub(rows, {
      competencia,
      statuses: status ? [status] : ['ready', 'sent'],
    });

    const enrichment = await this.sigtap.enrichProcedureCodes(exported.lines.map((l) => l.procedimento));
    const lines = exported.lines.map((l) => {
      const meta = enrichment[l.procedimento];
      return {
        ...l,
        sigtapName: meta?.name || l.label,
        sigtapKnown: !!meta?.known,
        label: meta?.name || l.label,
      };
    });
    const unknownCodes = [...new Set(lines.filter((l) => !l.sigtapKnown).map((l) => l.procedimento))];

    await this.prisma.audit(
      'export_bpa',
      'production_batch',
      'aggregate',
      [RF.BPA.id, RF.BILLING_AMB.id, RF.PROD.id, RF.SIGTAP_VALIDATE.id],
      {
        competencia: exported.competencia,
        totalLines: lines.length,
        unknownCodes,
      },
    );

    return {
      ...exported,
      lines,
      sigtap: {
        known: lines.filter((l) => l.sigtapKnown).length,
        unknown: unknownCodes.length,
        unknownCodes,
      },
      rfIds: [...exported.rfIds, RF.SIGTAP_VALIDATE.id],
    };
  }
}

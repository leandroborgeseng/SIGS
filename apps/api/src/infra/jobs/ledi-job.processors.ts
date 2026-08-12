import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JobsService } from './jobs.service';
import { JOB_NAMES, QueueService } from '../queue/queue.service';
import { LediFaoBatchService } from '../../care-extra/ledi-fao-batch.service';
import { StorageService } from '../storage/storage.service';
import type { AutoFixLediFaoBatchDto } from '../../care-extra/dto';

@Injectable()
export class LediJobProcessors {
  private readonly log = new Logger(LediJobProcessors.name);

  constructor(
    private readonly queue: QueueService,
    private readonly jobs: JobsService,
    private readonly storage: StorageService,
    private readonly moduleRef: ModuleRef,
  ) {}

  register() {
    this.queue.registerProcessor(JOB_NAMES.LEDI_AUTO_FIX, (payload) => this.runAutoFix(payload));
    this.queue.registerProcessor(JOB_NAMES.LEDI_EXPORT_ZIP, (payload) => this.runExportZip(payload));
  }

  private batches() {
    return this.moduleRef.get(LediFaoBatchService, { strict: false });
  }

  private async runAutoFix(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    const batchId = String(payload.batchId);
    await this.jobs.markActive(jobRunId);
    await this.jobs.markProgress(jobRunId, 5, 'Iniciando auto-correção');
    try {
      const dto = (payload.dto || {}) as AutoFixLediFaoBatchDto;
      const result = await this.batches().autoFix(batchId, dto);
      await this.jobs.markProgress(jobRunId, 95, 'Finalizando');
      const summary = {
        touched: result.touched,
        withBlockers: result.summary?.withBlockers,
        siapsReady: result.summary?.siapsReady,
        readyForFinalSend: result.summary?.readyForFinalSend,
      };
      await this.jobs.markCompleted(jobRunId, summary);
      return summary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`auto-fix job ${jobRunId}: ${msg}`);
      await this.jobs.markFailed(jobRunId, msg);
      throw err;
    }
  }

  private async runExportZip(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    const batchId = String(payload.batchId);
    const mode = payload.mode === 'conformant' ? 'conformant' : 'current';
    await this.jobs.markActive(jobRunId);
    try {
      const file = await this.batches().exportZipBuffer(batchId, mode);
      const stored = await this.storage.put(
        this.storage.buildKey(['exports', 'ledi', batchId, `${jobRunId}.zip`]),
        file,
        'application/zip',
      );
      const result = { size: stored.size, objectKey: stored.key, mode };
      await this.jobs.markCompleted(jobRunId, result, stored.key);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.jobs.markFailed(jobRunId, msg);
      throw err;
    }
  }
}

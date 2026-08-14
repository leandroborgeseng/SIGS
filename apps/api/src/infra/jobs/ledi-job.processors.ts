import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JobsService } from './jobs.service';
import { JOB_NAMES, QueueService } from '../queue/queue.service';
import { LediFaoBatchService } from '../../care-extra/ledi-fao-batch.service';
import { StorageService } from '../storage/storage.service';
import { extractXmlFilesFromZipBuffer, extractXmlFilesFromZipPath } from '../../care-extra/ledi-zip.extract';
import { extractTipoMismatch } from '../../care-extra/ledi-ficha-tipo';
import type { AutoFixLediFaoBatchDto } from '../../care-extra/dto';
import {
  lediFichaProgressMessage,
  lediFichaProgressPct,
  parseAutofixCheckpoint,
} from '../../care-extra/ledi-job-progress';

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
    this.queue.registerProcessor(JOB_NAMES.LEDI_IMPORT_ZIP, (payload) => this.runImportZip(payload));
  }

  private batches() {
    return this.moduleRef.get(LediFaoBatchService, { strict: false });
  }

  private async runAutoFix(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    const batchId = String(payload.batchId);
    const dryRun = payload.dryRun === true;
    const dto = (payload.dto || {}) as AutoFixLediFaoBatchDto;
    const mode = dryRun ? 'dry-run' : 'apply';
    await this.jobs.markActive(jobRunId);

    const current = await this.jobs.get(jobRunId);
    const checkpoint = parseAutofixCheckpoint(current.result);
    const startOffset = checkpoint?.processed ?? 0;
    const knownTotal = checkpoint?.total ?? 0;
    await this.jobs.markProgress(
      jobRunId,
      startOffset && knownTotal ? lediFichaProgressPct(startOffset, knownTotal) : 1,
      startOffset
        ? lediFichaProgressMessage(startOffset, knownTotal, mode)
        : dryRun
          ? 'Iniciando simulação'
          : 'Iniciando auto-correção',
      checkpoint || { processed: 0, total: 0, touched: 0, dryRun, batchId },
    );

    try {
      if (dryRun) {
        const result = await this.batches().dryRunInChunks(batchId, dto, {
          checkpoint,
          onProgress: async (p) => {
            await this.jobs.markProgress(
              jobRunId,
              lediFichaProgressPct(p.processed, p.total),
              lediFichaProgressMessage(p.processed, p.total, 'dry-run'),
              p,
            );
          },
        });
        await this.jobs.markCompleted(jobRunId, {
          ...result,
          processed: result.processed,
          total: result.totalConsidered,
          touched: result.wouldTouch,
          dryRun: true,
        });
        return result;
      }

      const result = await this.batches().autoFixInChunks(batchId, dto, {
        startOffset,
        onProgress: async (p) => {
          await this.jobs.markProgress(
            jobRunId,
            lediFichaProgressPct(p.processed, p.total),
            lediFichaProgressMessage(p.processed, p.total, 'apply'),
            p,
          );
        },
      });
      const batch = await this.batches().get(batchId);
      const summary = {
        touched: result.touched,
        processed: result.processed,
        total: result.total,
        withBlockers: batch.summary?.withBlockers,
        siapsReady: batch.summary?.siapsReady,
        readyForFinalSend: batch.summary?.readyForFinalSend,
        summary: batch.summary,
        batchId,
        dryRun: false,
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
    const mode =
      payload.mode === 'pending' ? 'pending' : payload.mode === 'conformant' ? 'conformant' : 'current';
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

  private async runImportZip(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    const objectKey = String(payload.objectKey || '');
    const name = typeof payload.name === 'string' ? payload.name : undefined;
    const expectedTipo =
      payload.expectedTipo === 'FAI' || payload.expectedTipo === 'PROCEDIMENTOS'
        ? payload.expectedTipo
        : 'FAO';
    const xmlCount = typeof payload.xmlCount === 'number' ? payload.xmlCount : undefined;
    await this.jobs.markActive(jobRunId);
    await this.jobs.markProgress(
      jobRunId,
      8,
      xmlCount ? `Lendo ZIP (${xmlCount} XMLs)…` : 'Lendo ZIP…',
    );
    try {
      if (!objectKey) throw new Error('Import ZIP sem objectKey');
      const localPath = this.storage.tryLocalPath(objectKey);
      await this.jobs.markProgress(jobRunId, 12, 'Extraindo XMLs do ZIP no servidor…');
      const files = localPath
        ? await extractXmlFilesFromZipPath(localPath)
        : await extractXmlFilesFromZipBuffer(await this.storage.getBuffer(objectKey));
      await this.jobs.markProgress(jobRunId, 13, 'Conferindo tipo das fichas…');
      await this.jobs.markProgress(
        jobRunId,
        15,
        lediFichaProgressMessage(0, files.length, 'import'),
        { processed: 0, total: files.length },
      );
      const batch = await this.batches().create(
        { name, expectedTipo, files },
        {
          onProgress: async (p) => {
            await this.jobs.markProgress(
              jobRunId,
              15 + Math.round(lediFichaProgressPct(p.processed, p.total) * 0.8),
              lediFichaProgressMessage(p.processed, p.total, 'import'),
              p,
            );
          },
        },
      );
      const summary = {
        batchId: batch.id,
        total: batch.summary?.total,
        withBlockers: batch.summary?.withBlockers,
        siapsReady: batch.summary?.siapsReady,
        readyForFinalSend: batch.summary?.readyForFinalSend,
        expectedTipo,
        processed: batch.summary?.total ?? files.length,
        summary: batch.summary,
      };
      await this.jobs.markCompleted(jobRunId, summary);
      return summary;
    } catch (err) {
      const mismatch = extractTipoMismatch(err);
      if (mismatch) {
        this.log.warn(`import-zip job ${jobRunId}: tipo recusado (${mismatch.detectedTipo})`);
        await this.jobs.markFailed(jobRunId, mismatch.message, true, mismatch);
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`import-zip job ${jobRunId}: ${msg}`);
      await this.jobs.markFailed(jobRunId, msg);
      throw err;
    }
  }
}

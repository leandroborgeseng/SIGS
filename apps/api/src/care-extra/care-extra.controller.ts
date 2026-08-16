import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';
import { LediZipChunkService } from './ledi-zip-chunk.service';
import {
  extractXmlFilesFromLoadedZip,
  lediBatchMaxFiles,
  lediImportAsyncThreshold,
  listLediXmlEntries,
  loadLediZip,
} from './ledi-zip.extract';
import { LEDI_ZIP_MAX_BYTES, LEDI_ZIP_MAX_LABEL } from './ledi-zip.limits';
import { mergeLediChunkInput } from './ledi-chunk-body';
import { JobsService } from '../infra/jobs/jobs.service';
import { JOB_NAMES } from '../infra/queue/queue.service';
import { StorageService } from '../infra/storage/storage.service';
import { randomUUID } from 'crypto';
import { buildPendingReportPdf } from './ledi-pending-report-pdf';
import {
  lediAutofixAsyncThreshold,
  lediAutofixIdempotencyKey,
} from './ledi-job-progress';
import {
  CreateDentalEncounterDto,
  CreateHomeCareVisitDto,
  CreateCollectiveActivityDto,
  FinishDentalEncounterDto,
  FinishHomeCareVisitDto,
  FinishCollectiveActivityDto,
  ValidateDentalFaoDto,
  CreateLediFaoBatchDto,
  AppendLediFaoBatchDto,
  CreateLediFaoBatchFromZipDto,
  LediZipChunkQueryDto,
  AutoFixLediFaoBatchDto,
  PatchLediFaoBatchItemDto,
  PatchDentalEncounterDto,
  VoidDentalEncounterDto,
  SyncDentalFaturamentoQueueDto,
  AddHomeCareChildDto,
} from './dto';

const XML_UPLOAD = FilesInterceptor('files', 200, {
  limits: { fileSize: 5 * 1024 * 1024, fieldSize: 1024 * 1024, fields: 16 },
});

const ZIP_UPLOAD = FileInterceptor('file', {
  limits: { fileSize: LEDI_ZIP_MAX_BYTES, fieldSize: 1024 * 1024, fields: 16, files: 1 },
});

function mapUploadedXmls(files?: Express.Multer.File[]) {
  if (!files?.length) throw new BadRequestException('Envie ao menos um arquivo XML.');
  return files.map((f) => ({
    name: (f.originalname || 'arquivo.xml').slice(0, 255),
    xml: Buffer.from(f.buffer).toString('utf8'),
  }));
}

@Controller('v1')
export class CareExtraController {
  constructor(
    private readonly service: CareExtraService,
    private readonly faoBatches: LediFaoBatchService,
    private readonly jobs: JobsService,
    private readonly storage: StorageService,
    private readonly zipChunks: LediZipChunkService,
  ) {}

  /**
   * ZIP típico e-SUS (`sistemas/<unidade>/*.xml`, milhares de fichas):
   * acima do limiar, enfileira análise para não estourar timeout do gateway.
   */
  private async ingestLediZip(
    buf: Buffer,
    opts: { name?: string; expectedTipo?: string },
    res?: Response,
  ) {
    const zip = await loadLediZip(buf);
    const xmlCount = listLediXmlEntries(zip).length;
    if (!xmlCount) {
      throw new Error(
        'ZIP sem arquivos .xml (confira se comprimiu a pasta certa; o SIGS ignora __MACOSX, AppleDouble e .DS_Store).',
      );
    }
    const maxFiles = lediBatchMaxFiles();
    if (xmlCount > maxFiles) {
      throw new Error(
        `ZIP tem ${xmlCount} arquivos .xml; o limite por lote é ${maxFiles}. Divida o lote (por unidade/período) ou envie em partes.`,
      );
    }
    const expectedTipo = (opts.expectedTipo as 'FAO' | 'FAI' | 'PROCEDIMENTOS') || 'FAO';
    const threshold = lediImportAsyncThreshold();
    if (xmlCount >= threshold) {
      const stored = await this.storage.put(
        this.storage.buildKey(['uploads', 'ledi-zip', `${randomUUID()}.zip`]),
        buf,
        'application/zip',
      );
      const job = await this.jobs.enqueue({
        type: JOB_NAMES.LEDI_IMPORT_ZIP,
        payload: {
          objectKey: stored.key,
          name: opts.name,
          expectedTipo,
          xmlCount,
        },
      });
      res?.status(202);
      return {
        async: true as const,
        jobId: job.id,
        status: job.status,
        xmlCount,
        message: `ZIP com ${xmlCount} XMLs enfileirado para análise. Consulte GET /api/v1/jobs/${job.id}`,
      };
    }
    const files = await extractXmlFilesFromLoadedZip(zip);
    return this.faoBatches.create({
      name: opts.name,
      expectedTipo,
      files,
    });
  }

  @Get('catalog/dental')
  catalogDental() {
    return this.service.catalogDental();
  }

  @Post('dental/ledi/validate-xml')
  validateDentalFao(@Body() dto: ValidateDentalFaoDto) {
    return this.service.validateDentalFao(dto);
  }

  @Get('dental/ledi/batches')
  listFaoBatches() {
    return this.faoBatches.list();
  }

  @Post('dental/ledi/batches')
  async createFaoBatch(@Body() dto: CreateLediFaoBatchDto) {
    return this.faoBatches.create(dto);
  }

  /** Upload multipart — o browser envia os File sem ler o conteúdo em JS (evita I/O read failed). */
  @Post('dental/ledi/batches/upload')
  @UseInterceptors(XML_UPLOAD)
  async createFaoBatchUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('name') name?: string,
    @Body('expectedTipo') expectedTipo?: string,
  ) {
    return this.faoBatches.create({
      name,
      expectedTipo: (expectedTipo as 'FAO' | 'FAI' | 'PROCEDIMENTOS') || 'FAO',
      files: mapUploadedXmls(files),
    });
  }

  /** ZIP via JSON base64 — fallback legado (corpo ~1.33× maior; preferir /upload-zip). */
  @Post('dental/ledi/batches/from-zip')
  async createFaoBatchFromZipJson(
    @Body() dto: CreateLediFaoBatchFromZipDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const raw = (dto.zipBase64 || '').replace(/^data:.*?;base64,/, '').trim();
    if (!raw) throw new BadRequestException('zipBase64 vazio');
    let buf: Buffer;
    try {
      buf = Buffer.from(raw, 'base64');
    } catch {
      throw new BadRequestException('zipBase64 inválido');
    }
    if (buf.length < 4) throw new BadRequestException('ZIP muito pequeno');
    try {
      return await this.ingestLediZip(buf, { name: dto.name, expectedTipo: dto.expectedTipo }, res);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'ZIP inválido');
    }
  }

  /** Upload de um .zip multipart (caminho legado / CLI — até 100 MB). A UI grande usa /chunk. */
  @Post('dental/ledi/batches/upload-zip')
  @UseInterceptors(ZIP_UPLOAD)
  async createFaoBatchFromZip(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('expectedTipo') expectedTipo?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo .zip no campo "file".');
    }
    try {
      return await this.ingestLediZip(
        file.buffer,
        {
          name: name || file.originalname?.replace(/\.zip$/i, '') || undefined,
          expectedTipo,
        },
        res,
      );
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'ZIP inválido');
    }
  }

  /**
   * Fatia do ZIP (UI: qualquer ZIP; CLI). Junta em disco; a última fatia
   * enfileira análise (não extrai 8k–20k XML neste request HTTP).
   * 1ª fatia: 200 JSON imediato (só cria tmp + grava a parte). Unzip só no job.
   * Corpo: octet-stream ou JSON `{ uploadId, index, total, data: base64 }`.
   */
  @HttpCode(200)
  @Post('dental/ledi/batches/upload-zip/chunk')
  @Put('dental/ledi/batches/upload-zip/chunk')
  async uploadZipChunk(
    @Req() req: Request,
    @Query() q: LediZipChunkQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const input = mergeLediChunkInput(req, q);
    const progress = await this.zipChunks.acceptChunk(input);
    if (!progress.complete) {
      res?.status(200);
      return progress;
    }
    try {
      const stored = await this.storage.putFromFile(
        this.storage.buildKey(['uploads', 'ledi-zip', `${input.uploadId}.zip`]),
        progress.assembledPath,
        'application/zip',
      );
      const job = await this.jobs.enqueue({
        type: JOB_NAMES.LEDI_IMPORT_ZIP,
        idempotencyKey: `ledi-import-zip:${input.uploadId}`,
        payload: {
          objectKey: stored.key,
          name: progress.name || progress.fileName.replace(/\.zip$/i, ''),
          expectedTipo: progress.expectedTipo,
        },
      });
      res?.status(202);
      return {
        async: true as const,
        jobId: job.id,
        status: job.status,
        message: `ZIP recebido (até ${LEDI_ZIP_MAX_LABEL}). Analisando no servidor. Consulte GET /api/v1/jobs/${job.id}`,
      };
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'ZIP inválido');
    } finally {
      await this.zipChunks.cleanup(input.uploadId);
    }
  }

  @Post('dental/ledi/batches/:batchId/upload')
  @UseInterceptors(XML_UPLOAD)
  async appendFaoBatchUpload(
    @Param('batchId') batchId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('summarize') summarize?: string,
    @Body('expectedTipo') _expectedTipo?: string,
  ) {
    return this.faoBatches.appendFiles(batchId, mapUploadedXmls(files), {
      refreshSummary: summarize !== '0' && summarize !== 'false',
    });
  }

  @Post('dental/ledi/batches/:batchId/append')
  appendFaoBatchJson(
    @Param('batchId') batchId: string,
    @Body() dto: AppendLediFaoBatchDto,
    @Query('summarize') summarize?: string,
  ) {
    return this.faoBatches.appendFiles(batchId, dto.files || [], {
      refreshSummary: summarize !== '0' && summarize !== 'false',
    });
  }

  @Delete('dental/ledi/batches')
  deleteAllFaoBatches() {
    return this.faoBatches.deleteAll();
  }

  @Get('dental/ledi/batches/:batchId')
  getFaoBatch(@Param('batchId') batchId: string) {
    return this.faoBatches.get(batchId);
  }

  @Delete('dental/ledi/batches/:batchId')
  deleteFaoBatch(@Param('batchId') batchId: string) {
    return this.faoBatches.delete(batchId);
  }

  @Get('dental/ledi/batches/:batchId/items')
  listFaoBatchItems(
    @Param('batchId') batchId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('code') code?: string,
    @Query('tipo') tipo?: string,
    @Query('bucket') bucket?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.faoBatches.listItems(batchId, {
      status,
      q,
      code,
      tipo,
      bucket,
      offset: offset ? Number(offset) : 0,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get('dental/ledi/batches/:batchId/items/:itemId')
  getFaoBatchItem(@Param('batchId') batchId: string, @Param('itemId') itemId: string) {
    return this.faoBatches.getItem(batchId, itemId);
  }

  @Patch('dental/ledi/batches/:batchId/items/:itemId')
  patchFaoBatchItem(
    @Param('batchId') batchId: string,
    @Param('itemId') itemId: string,
    @Body() dto: PatchLediFaoBatchItemDto,
  ) {
    return this.faoBatches.patchItem(batchId, itemId, dto);
  }

  @Post('dental/ledi/batches/:batchId/auto-fix')
  @HttpCode(200)
  async autoFixFaoBatch(
    @Param('batchId') batchId: string,
    @Body() dto: AutoFixLediFaoBatchDto,
    @Query('async') asyncFlag?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.enqueueAutofixOrRun(batchId, dto, { dryRun: false, asyncFlag, res });
  }

  @Post('dental/ledi/batches/:batchId/dry-run')
  @HttpCode(200)
  async dryRunFaoBatch(
    @Param('batchId') batchId: string,
    @Body() dto: AutoFixLediFaoBatchDto,
    @Query('async') asyncFlag?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.enqueueAutofixOrRun(batchId, dto, { dryRun: true, asyncFlag, res });
  }

  private async enqueueAutofixOrRun(
    batchId: string,
    dto: AutoFixLediFaoBatchDto,
    opts: { dryRun: boolean; asyncFlag?: string; res?: Response },
  ) {
    const threshold = lediAutofixAsyncThreshold();
    const itemCount = await this.faoBatches.countItems(batchId, {
      onlyItemIds: dto.onlyItemIds,
      onlyCode: dto.onlyCode,
    });
    const wantAsync =
      opts.asyncFlag === '1' ||
      opts.asyncFlag === 'true' ||
      itemCount >= threshold ||
      process.env.LEDI_AUTOFIX_FORCE_ASYNC === '1';

    if (wantAsync) {
      const job = await this.jobs.enqueue({
        type: JOB_NAMES.LEDI_AUTO_FIX,
        idempotencyKey: lediAutofixIdempotencyKey(batchId, {
          dryRun: opts.dryRun,
          onlyItemIds: dto.onlyItemIds,
          onlyCode: dto.onlyCode,
        }),
        payload: { batchId, dto, dryRun: opts.dryRun },
      });
      opts.res?.status(202);
      return {
        async: true as const,
        jobId: job.id,
        status: job.status,
        itemCount,
        dryRun: opts.dryRun,
        message: opts.dryRun
          ? 'Simulação enfileirada. Consulte GET /api/v1/jobs/:id'
          : 'Auto-correção enfileirada. Consulte GET /api/v1/jobs/:id',
      };
    }

    return opts.dryRun ? this.faoBatches.dryRun(batchId, dto) : this.faoBatches.autoFix(batchId, dto);
  }

  @Post('dental/ledi/batches/:batchId/export')
  @HttpCode(202)
  async enqueueExportFaoBatch(
    @Param('batchId') batchId: string,
    @Query('mode') mode: 'current' | 'conformant' | 'pending' | undefined,
  ) {
    const job = await this.jobs.enqueue({
      type: JOB_NAMES.LEDI_EXPORT_ZIP,
      payload: {
        batchId,
        mode: mode === 'pending' ? 'pending' : mode === 'conformant' ? 'conformant' : 'current',
      },
    });
    return {
      async: true,
      jobId: job.id,
      status: job.status,
      message: 'Export ZIP enfileirado. Consulte GET /api/v1/jobs/:id (resultObjectKey).',
    };
  }

  @Get('dental/ledi/batches/:batchId/closure-report')
  closureReportFaoBatch(@Param('batchId') batchId: string) {
    return this.faoBatches.closureReport(batchId);
  }

  @Get('dental/ledi/batches/:batchId/pending-report')
  async pendingReportFaoBatch(
    @Param('batchId') batchId: string,
    @Query('severity') severity: string | undefined,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.faoBatches.pendingReport(batchId, { severity });
    const fmt = (format || 'json').toLowerCase();
    if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ledi-pendencias-${batchId.slice(0, 8)}.csv"`,
      );
      return new StreamableFile(Buffer.from(`\uFEFF${report.csv}`, 'utf8'));
    }
    if (fmt === 'md' || fmt === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ledi-pendencias-${batchId.slice(0, 8)}.md"`,
      );
      return new StreamableFile(Buffer.from(report.markdown, 'utf8'));
    }
    if (fmt === 'pdf') {
      const pdf = await buildPendingReportPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ledi-pendencias-secretaria-${batchId.slice(0, 8)}.pdf"`,
      );
      return new StreamableFile(pdf);
    }
    return report;
  }

  @Get('dental/ledi/batches/:batchId/export.zip')
  @Header('Content-Type', 'application/zip')
  async exportFaoBatchZip(
    @Param('batchId') batchId: string,
    @Query('mode') mode: 'current' | 'conformant' | 'pending' | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resolved =
      mode === 'pending' ? 'pending' : mode === 'conformant' ? 'conformant' : 'current';
    const file = await this.faoBatches.exportZip(batchId, resolved);
    const suffix =
      resolved === 'conformant' ? '-aptos-envio' : resolved === 'pending' ? '-pendentes' : '';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledi-lote-${batchId.slice(0, 8)}${suffix}.zip"`,
    );
    return file;
  }

  @Get('dental/faturamento-queue')
  dentalFaturamentoQueue(
    @Query('competencia') competencia?: string,
    @Query('facilityId') facilityId?: string,
    @Query('bucket') bucket?: string,
    @Query('forceSync') forceSync?: string,
  ) {
    return this.service.listDentalFaturamentoQueue({
      competencia,
      facilityId,
      bucket,
      forceSync: forceSync === '1' || forceSync === 'true',
    });
  }

  /** Sync em lote — declarar antes de `:encounterId/sync`. */
  @Post('dental/faturamento-queue/sync')
  syncDentalFaturamentoQueueBatch(@Body() dto: SyncDentalFaturamentoQueueDto) {
    return this.service.syncDentalFaturamentoQueueBatch(dto);
  }

  @Post('dental/faturamento-queue/:encounterId/sync')
  syncDentalFaturamentoQueue(@Param('encounterId') encounterId: string) {
    return this.service.syncDentalBillingQueue(encounterId);
  }

  @Get('dental-encounters')
  listDental(@Query('facilityId') facilityId?: string) {
    return this.service.listDental(facilityId);
  }

  @Post('dental-encounters')
  openDental(@Body() dto: CreateDentalEncounterDto) {
    return this.service.openDental(dto);
  }

  @Get('dental-encounters/:id')
  getDental(@Param('id') id: string) {
    return this.service.getDental(id);
  }

  @Get('dental-encounters/:id/odontogram-history')
  odontogramHistory(@Param('id') id: string) {
    return this.service.listDentalOdontogramHistory(id);
  }

  @Patch('dental-encounters/:id/odontogram-history/:sourceId')
  applyOdontogramSnapshot(@Param('id') id: string, @Param('sourceId') sourceId: string) {
    return this.service.applyDentalOdontogramSnapshot(id, sourceId);
  }

  @Patch('dental-encounters/:id')
  patchDental(@Param('id') id: string, @Body() dto: PatchDentalEncounterDto) {
    return this.service.patchDental(id, dto);
  }

  @Get('dental-encounters/:id/preview-fao')
  previewDentalFao(@Param('id') id: string) {
    return this.service.previewDentalFao(id);
  }

  @Post('dental-encounters/:id/finish')
  finishDental(@Param('id') id: string, @Body() dto: FinishDentalEncounterDto) {
    return this.service.finishDental(id, dto);
  }

  @Post('dental-encounters/:id/void')
  voidDental(@Param('id') id: string, @Body() dto: VoidDentalEncounterDto) {
    return this.service.voidDental(id, dto);
  }

  @Get('home-care-visits')
  listHomeCare(@Query('facilityId') facilityId?: string) {
    return this.service.listHomeCare(facilityId);
  }

  @Get('catalog/home-care')
  catalogHomeCare() {
    return this.service.catalogHomeCare();
  }

  @Post('home-care-visits')
  openHomeCare(@Body() dto: CreateHomeCareVisitDto) {
    return this.service.openHomeCare(dto);
  }

  @Get('home-care-visits/:id')
  getHomeCare(@Param('id') id: string) {
    return this.service.getHomeCare(id);
  }

  @Post('home-care-visits/:id/children')
  addHomeCareChild(@Param('id') id: string, @Body() dto: AddHomeCareChildDto) {
    return this.service.addHomeCareChild(id, dto);
  }

  @Delete('home-care-visits/:id/children/:patientId')
  removeHomeCareChild(@Param('id') id: string, @Param('patientId') patientId: string) {
    return this.service.removeHomeCareChild(id, patientId);
  }

  @Post('home-care-visits/:id/preview')
  previewHomeCare(@Param('id') id: string, @Body() dto: FinishHomeCareVisitDto) {
    return this.service.previewHomeCare(id, dto || {});
  }

  @Post('home-care-visits/:id/finish')
  finishHomeCare(@Param('id') id: string, @Body() dto: FinishHomeCareVisitDto) {
    return this.service.finishHomeCare(id, dto);
  }

  @Get('catalog/collective')
  catalogCollective() {
    return this.service.catalogCollective();
  }

  @Get('collective-activities')
  listCollective(@Query('facilityId') facilityId?: string) {
    return this.service.listCollective(facilityId);
  }

  @Post('collective-activities')
  openCollective(@Body() dto: CreateCollectiveActivityDto) {
    return this.service.openCollective(dto);
  }

  @Get('collective-activities/:id')
  getCollective(@Param('id') id: string) {
    return this.service.getCollective(id);
  }

  @Post('collective-activities/:id/finish')
  finishCollective(@Param('id') id: string, @Body() dto: FinishCollectiveActivityDto) {
    return this.service.finishCollective(id, dto);
  }
}

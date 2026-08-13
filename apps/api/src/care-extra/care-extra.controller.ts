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
import { JobsService } from '../infra/jobs/jobs.service';
import { JOB_NAMES } from '../infra/queue/queue.service';
import { StorageService } from '../infra/storage/storage.service';
import { randomUUID } from 'crypto';
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
} from './dto';

const XML_UPLOAD = FilesInterceptor('files', 200, {
  limits: { fileSize: 5 * 1024 * 1024, fieldSize: 1024 * 1024, fields: 16 },
});

const ZIP_UPLOAD = FileInterceptor('file', {
  limits: { fileSize: 80 * 1024 * 1024, fieldSize: 1024 * 1024, fields: 16, files: 1 },
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
  createFaoBatch(@Body() dto: CreateLediFaoBatchDto) {
    return this.faoBatches.create(dto);
  }

  /** Upload multipart — o browser envia os File sem ler o conteúdo em JS (evita I/O read failed). */
  @Post('dental/ledi/batches/upload')
  @UseInterceptors(XML_UPLOAD)
  createFaoBatchUpload(
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

  /** Upload de um .zip multipart (caminho legado — até 80mb). Preferir /upload-zip/chunk. */
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
   * Fatia raw do ZIP (512 KiB na UI). POST preferido (CORS/preflight);
   * PUT permanece por compat. A última fatia monta o ZIP em disco e ingere.
   */
  @Post('dental/ledi/batches/upload-zip/chunk')
  @Put('dental/ledi/batches/upload-zip/chunk')
  @HttpCode(200)
  async uploadZipChunk(
    @Req() req: Request,
    @Query() q: LediZipChunkQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const progress = await this.zipChunks.acceptChunk({
      uploadId: q.uploadId,
      index: q.index,
      total: q.total,
      body,
      fileName: q.fileName,
      expectedTipo: q.expectedTipo,
      name: q.name,
      totalBytes: q.totalBytes,
    });
    if (!progress.complete) return progress;
    try {
      const buf = await this.zipChunks.readAssembled(progress.assembledPath);
      return await this.ingestLediZip(
        buf,
        {
          name: progress.name || progress.fileName.replace(/\.zip$/i, ''),
          expectedTipo: progress.expectedTipo,
        },
        res,
      );
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'ZIP inválido');
    } finally {
      await this.zipChunks.cleanup(q.uploadId);
    }
  }

  @Post('dental/ledi/batches/:batchId/upload')
  @UseInterceptors(XML_UPLOAD)
  appendFaoBatchUpload(
    @Param('batchId') batchId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('expectedTipo') _expectedTipo?: string,
  ) {
    return this.faoBatches.appendFiles(batchId, mapUploadedXmls(files));
  }

  @Post('dental/ledi/batches/:batchId/append')
  appendFaoBatchJson(@Param('batchId') batchId: string, @Body() dto: AppendLediFaoBatchDto) {
    return this.faoBatches.appendFiles(batchId, dto.files || []);
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
    const threshold = Number(process.env.LEDI_AUTOFIX_ASYNC_THRESHOLD || 40);
    const itemCount = await this.faoBatches.countItems(batchId, dto.onlyItemIds);
    const wantAsync =
      asyncFlag === '1' ||
      asyncFlag === 'true' ||
      itemCount >= threshold ||
      process.env.LEDI_AUTOFIX_FORCE_ASYNC === '1';

    if (wantAsync) {
      const job = await this.jobs.enqueue({
        type: JOB_NAMES.LEDI_AUTO_FIX,
        payload: { batchId, dto },
      });
      res?.status(202);
      return {
        async: true,
        jobId: job.id,
        status: job.status,
        itemCount,
        message: 'Auto-correção enfileirada. Consulte GET /api/v1/jobs/:id',
      };
    }

    return this.faoBatches.autoFix(batchId, dto);
  }

  @Post('dental/ledi/batches/:batchId/export')
  @HttpCode(202)
  async enqueueExportFaoBatch(
    @Param('batchId') batchId: string,
    @Query('mode') mode: 'current' | 'conformant' | undefined,
  ) {
    const job = await this.jobs.enqueue({
      type: JOB_NAMES.LEDI_EXPORT_ZIP,
      payload: { batchId, mode: mode === 'conformant' ? 'conformant' : 'current' },
    });
    return {
      async: true,
      jobId: job.id,
      status: job.status,
      message: 'Export ZIP enfileirado. Consulte GET /api/v1/jobs/:id (resultObjectKey).',
    };
  }

  @Post('dental/ledi/batches/:batchId/dry-run')
  dryRunFaoBatch(@Param('batchId') batchId: string, @Body() dto: AutoFixLediFaoBatchDto) {
    return this.faoBatches.dryRun(batchId, dto);
  }

  @Get('dental/ledi/batches/:batchId/closure-report')
  closureReportFaoBatch(@Param('batchId') batchId: string) {
    return this.faoBatches.closureReport(batchId);
  }

  @Get('dental/ledi/batches/:batchId/export.zip')
  @Header('Content-Type', 'application/zip')
  async exportFaoBatchZip(
    @Param('batchId') batchId: string,
    @Query('mode') mode: 'current' | 'conformant' | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.faoBatches.exportZip(batchId, mode === 'conformant' ? 'conformant' : 'current');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledi-fao-lote-${batchId.slice(0, 8)}.zip"`,
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

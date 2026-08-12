import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CareExtraService } from './care-extra.service';
import { LediFaoBatchService } from './ledi-fao-batch.service';
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
  AutoFixLediFaoBatchDto,
  PatchLediFaoBatchItemDto,
} from './dto';

const XML_UPLOAD = FilesInterceptor('files', 200, {
  limits: { fileSize: 5 * 1024 * 1024 },
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
  ) {}

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
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.faoBatches.listItems(batchId, {
      status,
      q,
      code,
      tipo,
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
  autoFixFaoBatch(@Param('batchId') batchId: string, @Body() dto: AutoFixLediFaoBatchDto) {
    return this.faoBatches.autoFix(batchId, dto);
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

  @Post('dental-encounters/:id/finish')
  finishDental(@Param('id') id: string, @Body() dto: FinishDentalEncounterDto) {
    return this.service.finishDental(id, dto);
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

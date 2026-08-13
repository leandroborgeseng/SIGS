import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import {
  FinishEncounterDto,
  OpenEncounterDto,
  SaveClinicalDto,
  SyncApsFaturamentoQueueDto,
  UpdateEncounterStatusDto,
} from './dto';

@Controller('v1/catalog')
export class ApsCatalogController {
  constructor(private readonly service: EncountersService) {}

  @Get('aps')
  catalogAps() {
    return this.service.catalogAps();
  }
}

@Controller('v1/encounters')
export class EncountersController {
  constructor(private readonly service: EncountersService) {}

  @Get()
  list(@Query('facilityId') facilityId?: string, @Query('origin') origin?: string) {
    return this.service.list(facilityId, origin);
  }

  @Get('queue')
  queue(@Query('facilityId') facilityId?: string, @Query('status') status?: string) {
    return this.service.queue(facilityId, status);
  }

  @Get('faturamento-queue')
  apsFaturamentoQueue(
    @Query('competencia') competencia?: string,
    @Query('facilityId') facilityId?: string,
    @Query('bucket') bucket?: string,
    @Query('forceSync') forceSync?: string,
  ) {
    return this.service.listApsFaturamentoQueue({
      competencia,
      facilityId,
      bucket,
      forceSync: forceSync === '1' || forceSync === 'true',
    });
  }

  /** Sync em lote — declarar antes de `:encounterId/sync`. */
  @Post('faturamento-queue/sync')
  syncApsFaturamentoQueueBatch(@Body() dto: SyncApsFaturamentoQueueDto) {
    return this.service.syncApsFaturamentoQueueBatch(dto);
  }

  @Post('faturamento-queue/:encounterId/sync')
  syncApsFaturamentoQueue(@Param('encounterId') encounterId: string) {
    return this.service.syncApsBillingQueue(encounterId);
  }

  @Post()
  open(@Body() dto: OpenEncounterDto) {
    return this.service.open(dto);
  }

  @Get(':id/preview-fai')
  previewFai(@Param('id') id: string) {
    return this.service.previewFai(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateEncounterStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Put(':id/clinical')
  saveClinical(@Param('id') id: string, @Body() dto: SaveClinicalDto) {
    return this.service.saveClinical(id, dto);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string, @Body() dto: FinishEncounterDto) {
    return this.service.finish(id, dto);
  }
}

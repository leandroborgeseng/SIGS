import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProductionService } from './production.service';
import {
  EnqueueBatchDto,
  MarkErrorDto,
  MarkSentDto,
  ReprocessDto,
  SendProductionDto,
} from './dto';

@Controller('v1/production')
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  @Get('batches')
  list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Get('batches/:id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('batches')
  enqueue(@Body() dto: EnqueueBatchDto) {
    return this.service.enqueue(dto);
  }

  /** Relatório completo antes de enviar produção/faturamento. */
  @Get('preflight')
  preflight(@Query('competencia') competencia?: string, @Query('status') status?: string) {
    return this.service.preflight({ competencia, status });
  }

  @Post('send')
  send(@Body() dto: SendProductionDto) {
    return this.service.send(dto);
  }

  @Post('batches/:id/mark-sent')
  markSent(@Param('id') id: string, @Body() dto: MarkSentDto) {
    return this.service.markSent(id, dto || {});
  }

  @Post('batches/:id/mark-error')
  markError(@Param('id') id: string, @Body() dto: MarkErrorDto) {
    return this.service.markError(id, dto || {});
  }

  @Post('batches/:id/reprocess')
  reprocess(@Param('id') id: string, @Body() dto: ReprocessDto) {
    return this.service.reprocess(id, dto || {});
  }

  @Post('batches/:id/promote')
  promote(@Param('id') id: string) {
    return this.service.promote(id);
  }

  @Post('batches/:id/reopen')
  reopen(@Param('id') id: string) {
    return this.service.reopen(id);
  }

  /** Export BPA stub (JSON + CSV). Use requireOk=1 para exigir pré-envio limpo. */
  @Get('bpa/export')
  exportBpa(
    @Query('competencia') competencia?: string,
    @Query('status') status?: string,
    @Query('requireOk') requireOk?: string,
  ) {
    return this.service.exportBpa(competencia, status, {
      requirePreflightOk: requireOk === '1' || requireOk === 'true',
    });
  }
}

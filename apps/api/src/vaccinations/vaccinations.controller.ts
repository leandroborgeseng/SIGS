import { Body, Controller, Get, Header, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto, SyncVaccinationCatalogDto, VoidVaccinationDto } from './dto';

@Controller('v1')
export class VaccinationsController {
  constructor(private readonly service: VaccinationsService) {}

  @Get('catalog/vaccination')
  catalog() {
    return this.service.catalog();
  }

  @Post('catalog/vaccination/sync')
  syncCatalog(@Body() dto: SyncVaccinationCatalogDto) {
    return this.service.syncCatalog(dto);
  }

  @Post('catalog/vaccination/seed')
  seedCatalog() {
    return this.service.ensureSeeded({ force: true });
  }

  @Get('vaccinations')
  list(@Query('patientId') patientId?: string, @Query('facilityId') facilityId?: string) {
    return this.service.list(patientId, facilityId);
  }

  @Get('vaccinations/:id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('vaccinations')
  create(@Body() dto: CreateVaccinationDto) {
    return this.service.create(dto);
  }

  @Post('vaccinations/:id/void')
  voidRecord(@Param('id') id: string, @Body() dto: VoidVaccinationDto) {
    return this.service.void(id, dto);
  }

  @Get('patients/:patientId/vaccination-card')
  card(@Param('patientId') patientId: string) {
    return this.service.card(patientId);
  }

  @Get('patients/:patientId/vaccination-card.pdf')
  @Header('Content-Type', 'application/pdf')
  async cardPdf(@Param('patientId') patientId: string, @Res() res: Response) {
    const buf = await this.service.cardPdf(patientId);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="cartao-vacinal-${patientId.slice(0, 8)}.pdf"`,
    );
    res.send(buf);
  }
}

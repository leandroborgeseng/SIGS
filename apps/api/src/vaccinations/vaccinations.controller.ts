import { Body, Controller, Get, Header, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VaccinationsService } from './vaccinations.service';
import {
  CreateColdEquipmentDto,
  CreateSupplyDto,
  CreateSupplyLinkDto,
  CreateTempReadingDto,
  CreateThermalBoxDto,
  CreateVaccinationDto,
  CreateVaccinationStockDto,
  PatchColdEquipmentDto,
  PatchThermalBoxDto,
  SupplyEntryDto,
  SyncVaccinationCatalogDto,
  VoidVaccinationDto,
} from './dto';

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

  @Get('vaccination-stock')
  listStock(
    @Query('facilityId') facilityId?: string,
    @Query('immunobiologicalId') immunobiologicalId?: string,
  ) {
    return this.service.listStock(facilityId, immunobiologicalId);
  }

  @Post('vaccination-stock')
  createStock(@Body() dto: CreateVaccinationStockDto) {
    return this.service.createStock(dto);
  }

  @Get('vaccination-cold-equipment')
  listColdEquipment(@Query('facilityId') facilityId?: string) {
    return this.service.listColdEquipment(facilityId);
  }

  @Post('vaccination-cold-equipment')
  createColdEquipment(@Body() dto: CreateColdEquipmentDto) {
    return this.service.createColdEquipment(dto);
  }

  @Patch('vaccination-cold-equipment/:id')
  patchColdEquipment(@Param('id') id: string, @Body() dto: PatchColdEquipmentDto) {
    return this.service.patchColdEquipment(id, dto);
  }

  @Get('vaccination-thermal-boxes')
  listThermalBoxes(@Query('facilityId') facilityId?: string) {
    return this.service.listThermalBoxes(facilityId);
  }

  @Post('vaccination-thermal-boxes')
  createThermalBox(@Body() dto: CreateThermalBoxDto) {
    return this.service.createThermalBox(dto);
  }

  @Patch('vaccination-thermal-boxes/:id')
  patchThermalBox(@Param('id') id: string, @Body() dto: PatchThermalBoxDto) {
    return this.service.patchThermalBox(id, dto);
  }

  @Get('vaccination-temp-readings')
  listTempReadings(
    @Query('facilityId') facilityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listTempReadings(facilityId, limit ? Number(limit) : 50);
  }

  @Post('vaccination-temp-readings')
  createTempReading(@Body() dto: CreateTempReadingDto) {
    return this.service.createTempReading(dto);
  }

  @Get('vaccination-supplies')
  listSupplies(@Query('facilityId') facilityId?: string) {
    return this.service.listSupplies(facilityId);
  }

  @Post('vaccination-supplies')
  createSupply(@Body() dto: CreateSupplyDto) {
    return this.service.createSupply(dto);
  }

  @Post('vaccination-supplies/:id/entry')
  supplyEntry(@Param('id') id: string, @Body() dto: SupplyEntryDto) {
    return this.service.supplyEntry(id, dto);
  }

  @Get('vaccination-supply-links')
  listSupplyLinks(
    @Query('immunobiologicalId') immunobiologicalId?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.service.listSupplyLinks(immunobiologicalId, facilityId);
  }

  @Post('vaccination-supply-links')
  createSupplyLink(@Body() dto: CreateSupplyLinkDto) {
    return this.service.createSupplyLink(dto);
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

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto, IssuePrescriptionDto } from './dto';

@Controller('v1')
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  @Get('catalog/medications')
  medications(@Query('q') q?: string) {
    return this.service.searchMedications(q);
  }

  @Get('catalog/prescription-params')
  params() {
    return this.service.catalogParams();
  }

  @Post('catalog/medications/seed')
  seed() {
    return this.service.ensureMedSeeded();
  }

  @Get('prescriptions')
  list(
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({ patientId, encounterId, facilityId, status });
  }

  @Post('prescriptions')
  create(@Body() dto: CreatePrescriptionDto) {
    return this.service.create(dto);
  }

  @Get('prescriptions/:id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('prescriptions/:id/issue')
  issue(@Param('id') id: string, @Body() dto: IssuePrescriptionDto) {
    return this.service.issue(id, dto);
  }

  @Post('prescriptions/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}

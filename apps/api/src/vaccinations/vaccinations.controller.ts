import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto } from './dto';

@Controller('v1')
export class VaccinationsController {
  constructor(private readonly service: VaccinationsService) {}

  @Get('catalog/vaccination')
  catalog() {
    return this.service.catalog();
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

  @Get('patients/:patientId/vaccination-card')
  card(@Param('patientId') patientId: string) {
    return this.service.card(patientId);
  }
}

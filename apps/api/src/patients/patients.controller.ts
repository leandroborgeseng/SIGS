import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto } from './dto';

@Controller('v1/patients')
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  @Get()
  search(@Query('q') q?: string, @Query('birthDate') birthDate?: string) {
    return this.service.search(q, birthDate);
  }

  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.service.update(id, dto);
  }
}

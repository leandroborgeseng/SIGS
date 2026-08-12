import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RegulationService } from './regulation.service';
import {
  AuthorizeRegulationDto,
  ClassifyRegulationDto,
  CloseRegulationDto,
  CreateRegulationRequestDto,
  DenyRegulationDto,
  ReturnRegulationDto,
} from './dto';

@Controller('v1/regulation')
export class RegulationController {
  constructor(private readonly service: RegulationService) {}

  @Get('catalog')
  catalog() {
    return this.service.catalog();
  }

  @Post('seed')
  seed() {
    return this.service.ensureSeeded();
  }

  @Get('requests')
  list(
    @Query('facilityId') facilityId?: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('status') status?: string,
    @Query('openOnly') openOnly?: string,
  ) {
    return this.service.list({
      facilityId,
      patientId,
      encounterId,
      status,
      openOnly: openOnly === '1' || openOnly === 'true',
    });
  }

  @Post('requests')
  create(@Body() dto: CreateRegulationRequestDto) {
    return this.service.create(dto);
  }

  @Get('requests/:id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('requests/:id/submit')
  submit(@Param('id') id: string) {
    return this.service.submit(id);
  }

  @Post('requests/:id/classify')
  classify(@Param('id') id: string, @Body() dto: ClassifyRegulationDto) {
    return this.service.classify(id, dto);
  }

  @Post('requests/:id/authorize')
  authorize(@Param('id') id: string, @Body() dto: AuthorizeRegulationDto) {
    return this.service.authorize(id, dto);
  }

  @Post('requests/:id/deny')
  deny(@Param('id') id: string, @Body() dto: DenyRegulationDto) {
    return this.service.deny(id, dto);
  }

  @Post('requests/:id/return')
  returnForData(@Param('id') id: string, @Body() dto: ReturnRegulationDto) {
    return this.service.returnForData(id, dto);
  }

  @Post('requests/:id/close')
  close(@Param('id') id: string, @Body() dto: CloseRegulationDto) {
    return this.service.close(id, dto);
  }
}

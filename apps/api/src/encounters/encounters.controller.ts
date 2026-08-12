import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { FinishEncounterDto, OpenEncounterDto, SaveClinicalDto, UpdateEncounterStatusDto } from './dto';

@Controller('v1/encounters')
export class EncountersController {
  constructor(private readonly service: EncountersService) {}

  @Get('queue')
  queue(@Query('facilityId') facilityId?: string, @Query('status') status?: string) {
    return this.service.queue(facilityId, status);
  }

  @Post()
  open(@Body() dto: OpenEncounterDto) {
    return this.service.open(dto);
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

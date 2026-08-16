import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TerritoryService } from './territory.service';
import { CreateMicroAreaDto, CreatePatientTeamLinkDto, UpdatePatientTeamLinkDto } from './dto';

@Controller('v1')
export class TerritoryController {
  constructor(private readonly service: TerritoryService) {}

  @Get('micro-areas')
  listMicroAreas(@Query('teamId') teamId?: string) {
    return this.service.listMicroAreas(teamId);
  }

  @Post('micro-areas')
  createMicroArea(@Body() dto: CreateMicroAreaDto) {
    return this.service.createMicroArea(dto);
  }

  @Get('patient-team-links')
  listLinks(@Query('patientId') patientId?: string, @Query('teamId') teamId?: string) {
    return this.service.listLinks(patientId, teamId);
  }

  @Post('patient-team-links')
  createLink(@Body() dto: CreatePatientTeamLinkDto) {
    return this.service.createLink(dto);
  }

  @Patch('patient-team-links/:id')
  updateLink(@Param('id') id: string, @Body() dto: UpdatePatientTeamLinkDto) {
    return this.service.updateLink(id, dto);
  }
}

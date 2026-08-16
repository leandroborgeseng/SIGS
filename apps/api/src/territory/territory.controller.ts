import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TerritoryService } from './territory.service';
import {
  AddFamilyMemberDto,
  CreateHouseholdDto,
  CreateHouseholdFamilyDto,
  CreateMicroAreaDto,
  CreatePatientTeamLinkDto,
  UpdateFamilyMemberDto,
  UpdateHouseholdDto,
  UpdateHouseholdFamilyDto,
  UpdatePatientTeamLinkDto,
} from './dto';

@Controller('v1')
export class TerritoryController {
  constructor(private readonly service: TerritoryService) {}

  @Get('catalog/household')
  catalogHousehold() {
    return this.service.catalogHousehold();
  }

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

  @Get('households')
  listHouseholds(
    @Query('teamId') teamId?: string,
    @Query('microAreaId') microAreaId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.service.listHouseholds({ teamId, microAreaId, patientId });
  }

  @Post('households')
  createHousehold(@Body() dto: CreateHouseholdDto) {
    return this.service.createHousehold(dto);
  }

  @Get('households/:id')
  getHousehold(@Param('id') id: string) {
    return this.service.getHousehold(id);
  }

  @Patch('households/:id')
  updateHousehold(@Param('id') id: string, @Body() dto: UpdateHouseholdDto) {
    return this.service.updateHousehold(id, dto);
  }

  @Post('households/:id/families')
  createFamily(@Param('id') id: string, @Body() dto: CreateHouseholdFamilyDto) {
    return this.service.createFamily(id, dto);
  }

  @Patch('household-families/:id')
  updateFamily(@Param('id') id: string, @Body() dto: UpdateHouseholdFamilyDto) {
    return this.service.updateFamily(id, dto);
  }

  @Post('household-families/:id/members')
  addFamilyMember(@Param('id') id: string, @Body() dto: AddFamilyMemberDto) {
    return this.service.addFamilyMember(id, dto);
  }

  @Patch('family-members/:id')
  updateFamilyMember(@Param('id') id: string, @Body() dto: UpdateFamilyMemberDto) {
    return this.service.updateFamilyMember(id, dto);
  }
}

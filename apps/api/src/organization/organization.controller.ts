import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import {
  CreateAssignmentDto,
  CreateFacilityDto,
  CreateProfessionalDto,
  CreateTeamDto,
  EndAssignmentDto,
  UpdateFacilityDto,
} from './dto';

@Controller('v1')
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get('facilities')
  listFacilities(
    @Query('q') q?: string,
    @Query('active') active?: string,
    @Query('ibge') ibge?: string,
    @Query('gestao') gestao?: string,
    @Query('cnpj') cnpj?: string,
  ) {
    const a = active === undefined ? undefined : active === 'true' || active === '1';
    return this.service.listFacilities(q, a, ibge, gestao, cnpj);
  }

  @Post('facilities')
  createFacility(@Body() dto: CreateFacilityDto) {
    return this.service.createFacility(dto);
  }

  @Patch('facilities/:id')
  updateFacility(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.service.updateFacility(id, dto);
  }

  @Get('facilities/:id')
  getFacility(@Param('id') id: string) {
    return this.service.getFacility(id);
  }

  @Get('professionals')
  listProfessionals(@Query('q') q?: string) {
    return this.service.listProfessionals(q).then((rows) =>
      rows.map((r) => ({
        ...r,
        displayName: r.socialName || r.civilName,
      })),
    );
  }

  @Post('professionals')
  createProfessional(@Body() dto: CreateProfessionalDto) {
    return this.service.createProfessional(dto);
  }

  @Get('teams')
  listTeams(@Query('facilityId') facilityId?: string) {
    return this.service.listTeams(facilityId);
  }

  @Post('teams')
  createTeam(@Body() dto: CreateTeamDto) {
    return this.service.createTeam(dto);
  }

  @Get('assignments')
  listAssignments(
    @Query('facilityId') facilityId?: string,
    @Query('professionalId') professionalId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.listAssignments({
      facilityId,
      professionalId,
      activeOnly: activeOnly === '1' || activeOnly === 'true',
    });
  }

  @Post('assignments')
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.service.createAssignment(dto);
  }

  @Post('assignments/:id/end')
  endAssignment(@Param('id') id: string, @Body() dto: EndAssignmentDto) {
    return this.service.endAssignment(id, dto);
  }
}

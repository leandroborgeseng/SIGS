import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../auth/decorators';
import { PERMISSIONS } from '../auth/roles.seed';

@Controller('v1/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('encounters')
  @RequirePermissions(PERMISSIONS.REPORTS)
  encounters(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.reports.encounters(from, to, facilityId);
  }

  @Get('vaccinations')
  @RequirePermissions(PERMISSIONS.REPORTS)
  vaccinations(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.reports.vaccinations(from, to, facilityId);
  }
}

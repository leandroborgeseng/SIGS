import { Controller, Get, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators';
import { PERMISSIONS } from '../auth/roles.seed';
import { CnesService } from './cnes.service';
import { CnesAuditService } from './cnes-audit.service';
import {
  FRANCA_IBGE,
  loadBundledSnapshot,
  resolveCnesSnapshotPath,
} from './cnes.snapshot';
import type { CnesSyncSource } from './cnes.types';

@Controller('v1/cnes')
export class CnesController {
  constructor(
    private readonly cnes: CnesService,
    private readonly auditService: CnesAuditService,
  ) {}

  @Get('status')
  status(@Query('ibge') ibge?: string) {
    const ibgeCode = (ibge || FRANCA_IBGE).replace(/\D/g, '');
    return {
      ibgeCode,
      snapshotPath: resolveCnesSnapshotPath(ibgeCode),
      sync: 'POST /v1/cnes/sync?ibge=3516200&source=snapshot',
      audit: 'GET /v1/cnes/audit?ibge=3516200',
    };
  }

  @Get('snapshot')
  snapshotMeta(@Query('ibge') ibge?: string) {
    const ibgeCode = (ibge || FRANCA_IBGE).replace(/\D/g, '');
    try {
      const { snapshot, path } = loadBundledSnapshot(ibgeCode);
      return {
        path,
        meta: snapshot.meta,
        counts: {
          establishments: snapshot.establishments.length,
          teams: snapshot.teams.length,
        },
      };
    } catch (e) {
      return {
        ibgeCode,
        snapshotPath: resolveCnesSnapshotPath(ibgeCode),
        error: (e as Error).message,
      };
    }
  }

  @Post('sync')
  @RequirePermissions(PERMISSIONS.ORG)
  sync(
    @Query('ibge') ibge?: string,
    @Query('source') source?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.cnes.sync({
      ibge,
      source: (source as CnesSyncSource) || 'auto',
      activeOnly: activeOnly === '1' || activeOnly === 'true',
    });
  }

  @Get('audit')
  @RequirePermissions(PERMISSIONS.ORG)
  audit(@Query('ibge') ibge?: string, @Query('includeLedi') includeLedi?: string) {
    return this.auditService.audit({
      ibgeCode: ibge,
      includeLedi: includeLedi === undefined ? true : includeLedi === '1' || includeLedi === 'true',
    });
  }
}

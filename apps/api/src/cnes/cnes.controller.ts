import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators';
import { PERMISSIONS } from '../auth/roles.seed';
import { CnesService } from './cnes.service';
import { CnesAuditService } from './cnes-audit.service';
import { CnesTeamsService } from './cnes-teams.service';
import { annotateMunicipalNetwork, parseGestaoMode } from './cnes.filter';
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
    private readonly teamsExplorer: CnesTeamsService,
  ) {}

  @Get('status')
  status(@Query('ibge') ibge?: string) {
    const ibgeCode = (ibge || FRANCA_IBGE).replace(/\D/g, '');
    return {
      ibgeCode,
      snapshotPath: resolveCnesSnapshotPath(ibgeCode),
      syncOnBoot: process.env.CNES_SYNC_ON_BOOT === '1' || process.env.CNES_SYNC_ON_BOOT === 'true',
      defaultGestao: 'municipal',
      sync: 'POST /v1/cnes/sync?ibge=3516200&source=snapshot&gestao=municipal',
      syncTodos: 'POST /v1/cnes/sync?ibge=3516200&source=snapshot&gestao=todos',
      syncProfessionals: 'POST /v1/cnes/sync-professionals?ibge=3516200',
      audit: 'GET /v1/cnes/audit?ibge=3516200&gestao=municipal',
      teams: 'GET /v1/cnes/teams?ibge=3516200&gestao=municipal',
      teamDetail: 'GET /v1/cnes/teams/:id',
      multiTeam: 'GET /v1/cnes/multi-team?ibge=3516200&gestao=municipal',
      teamTypes: 'GET /v1/cnes/team-types',
      networkExport: 'GET /v1/cnes/network-export?ibge=3516200&gestao=municipal',
    };
  }

  @Get('snapshot')
  snapshotMeta(@Query('ibge') ibge?: string) {
    const ibgeCode = (ibge || FRANCA_IBGE).replace(/\D/g, '');
    try {
      const { snapshot, path } = loadBundledSnapshot(ibgeCode);
      const annotated = annotateMunicipalNetwork(snapshot);
      return {
        path,
        meta: annotated.meta,
        counts: annotated.meta.counts,
        gestaoCriterion: annotated.meta.gestaoCriterion,
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
    @Query('gestao') gestao?: string,
    @Query('somentePrefeitura') somentePrefeitura?: string,
  ) {
    return this.cnes.sync({
      ibge,
      source: (source as CnesSyncSource) || 'auto',
      activeOnly: activeOnly === '1' || activeOnly === 'true',
      gestao,
      somentePrefeitura,
    });
  }

  /** Profissionais lotados (PF) — snapshot municipal; exige sync de unidades/equipes antes. */
  @Post('sync-professionals')
  @RequirePermissions(PERMISSIONS.ORG)
  syncProfessionals(@Query('ibge') ibge?: string) {
    return this.cnes.syncProfessionals({ ibge });
  }

  @Get('audit')
  @RequirePermissions(PERMISSIONS.ORG)
  audit(
    @Query('ibge') ibge?: string,
    @Query('includeLedi') includeLedi?: string,
    @Query('gestao') gestao?: string,
    @Query('somentePrefeitura') somentePrefeitura?: string,
  ) {
    return this.auditService.audit({
      ibgeCode: ibge,
      includeLedi: includeLedi === undefined ? true : includeLedi === '1' || includeLedi === 'true',
      gestao: parseGestaoMode(gestao, somentePrefeitura),
    });
  }

  /** Catálogo de tipo de equipe CNES (labels legíveis; ex.: 76 = EAP). */
  @Get('team-types')
  teamTypes() {
    return this.teamsExplorer.teamTypesCatalog();
  }

  /**
   * Lista equipes (default rede municipal) com tipo+label, contagem de membros e unidade.
   * RF-2.19 / RF-2.61.
   */
  @Get('teams')
  @RequirePermissions(PERMISSIONS.ORG)
  listTeams(
    @Query('ibge') ibge?: string,
    @Query('gestao') gestao?: string,
    @Query('q') q?: string,
    @Query('teamTypeId') teamTypeId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.teamsExplorer.listTeams({
      ibge,
      gestao,
      q,
      teamTypeId,
      facilityId,
      activeOnly: activeOnly === undefined ? true : activeOnly === '1' || activeOnly === 'true',
    });
  }

  /** Profissionais com lotação ativa em mais de uma equipe (cruzamento). */
  @Get('multi-team')
  @RequirePermissions(PERMISSIONS.ORG)
  multiTeam(@Query('ibge') ibge?: string, @Query('gestao') gestao?: string) {
    return this.teamsExplorer.listMultiTeamProfessionals({ ibge, gestao });
  }

  /** CSV rede: unidades × equipes × PF (default municipal). */
  @Get('network-export')
  @RequirePermissions(PERMISSIONS.ORG)
  networkExport(@Query('ibge') ibge?: string, @Query('gestao') gestao?: string) {
    return this.teamsExplorer.exportNetwork({ ibge, gestao });
  }

  /** Detalhe da equipe + membros (nome, CNS, CBO+label, vínculo). */
  @Get('teams/:id')
  @RequirePermissions(PERMISSIONS.ORG)
  getTeam(@Param('id') id: string) {
    return this.teamsExplorer.getTeam(id);
  }
}

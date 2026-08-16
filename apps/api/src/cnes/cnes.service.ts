import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertIbgeCode } from '../ledi/ibge';
import { RF } from '../common/rf';
import { fetchLiveCnesSnapshot } from './cnes.fetch';
import { loadCnesSnapshot } from './cnes.loader';
import { parseGestaoMode } from './cnes.filter';
import { loadBundledSnapshot } from './cnes.snapshot';
import { loadCnesProfessionalsSnapshot } from './cnes.professionals.loader';
import { loadProfessionalsSnapshot } from './cnes.professionals.snapshot';
import type { CnesProfessionalsSyncResult } from './cnes.professionals.types';
import type { CnesSyncGestao, CnesSyncResult, CnesSyncSource } from './cnes.types';

@Injectable()
export class CnesService implements OnModuleInit {
  private readonly log = new Logger(CnesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const flag = (process.env.CNES_SYNC_ON_BOOT || '').trim();
    if (flag !== '1' && flag.toLowerCase() !== 'true') return;
    try {
      const gestao = parseGestaoMode(process.env.CNES_SYNC_GESTAO || 'municipal');
      const result = await this.sync({
        ibge: process.env.MUNICIPIO_IBGE || '3516200',
        source: 'snapshot',
        gestao,
      });
      this.log.log(
        `CNES_SYNC_ON_BOOT: ${result.ibgeCode} gestao=${result.gestao} fac +${result.facilities.created}/~${result.facilities.updated} · teams +${result.teams.created}/~${result.teams.updated} (${result.filter.after.establishments}/${result.filter.before.establishments} est.)`,
      );
      if (
        process.env.CNES_SYNC_PROFESSIONALS_ON_BOOT === '1' ||
        process.env.CNES_SYNC_PROFESSIONALS_ON_BOOT === 'true'
      ) {
        const pf = await this.syncProfessionals({ ibge: result.ibgeCode });
        this.log.log(
          `CNES_SYNC_PROFESSIONALS_ON_BOOT: +${pf.professionals.created}/~${pf.professionals.updated} prof · +${pf.assignments.created}/~${pf.assignments.updated} lot`,
        );
      }
    } catch (err) {
      this.log.error(`CNES_SYNC_ON_BOOT falhou: ${(err as Error).message}`);
    }
  }

  async sync(opts: {
    ibge?: string;
    source?: CnesSyncSource;
    activeOnly?: boolean;
    gestao?: CnesSyncGestao | string;
    somentePrefeitura?: boolean | string;
  }): Promise<CnesSyncResult> {
    let ibge: string;
    try {
      ibge = assertIbgeCode(opts.ibge || process.env.MUNICIPIO_IBGE || '3516200') || '3516200';
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const gestao = parseGestaoMode(opts.gestao, opts.somentePrefeitura);
    const preferred = opts.source || 'auto';
    let result: CnesSyncResult;

    if (preferred === 'snapshot') {
      result = await this.syncFromSnapshot(ibge, opts.activeOnly, gestao);
    } else if (preferred === 'live') {
      result = await this.syncFromLive(ibge, opts.activeOnly, gestao);
    } else {
      try {
        result = await this.syncFromLive(ibge, opts.activeOnly, gestao);
      } catch (err) {
        this.log.warn(`CNES live falhou (${(err as Error).message}); usando snapshot versionado`);
        result = await this.syncFromSnapshot(ibge, opts.activeOnly, gestao);
      }
    }

    await this.prisma.audit('sync', 'cnes', ibge, [RF.CNES_SYNC.id, RF.FACILITY_LIST.id, RF.TEAM.id], {
      source: result.source,
      gestao: result.gestao,
      filter: result.filter,
      facilities: result.facilities,
      teams: result.teams,
    });
    return result;
  }

  /** Importa profissionais lotados (PF público CNES → Professional + Assignment). Requer facilities/teams já sincronizados. */
  async syncProfessionals(opts: { ibge?: string } = {}): Promise<CnesProfessionalsSyncResult> {
    let ibge: string;
    try {
      ibge = assertIbgeCode(opts.ibge || process.env.MUNICIPIO_IBGE || '3516200') || '3516200';
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const { snapshot, path } = loadProfessionalsSnapshot(ibge);
    const result = await loadCnesProfessionalsSnapshot(this.prisma, snapshot, {
      source: 'snapshot',
      snapshotPath: path,
    });
    await this.prisma.audit(
      'sync',
      'cnes_professionals',
      ibge,
      [RF.CNES_SYNC.id, RF.PROFESSIONAL.id, RF.LOTATION.id],
      {
        professionals: result.professionals,
        assignments: result.assignments,
        totals: result.totals,
      },
    );
    return result;
  }

  private async syncFromSnapshot(
    ibge: string,
    activeOnly: boolean | undefined,
    gestao: CnesSyncGestao,
  ): Promise<CnesSyncResult> {
    const { snapshot, path } = loadBundledSnapshot(ibge);
    if (snapshot.meta.ibgeCode !== ibge) {
      throw new BadRequestException(`snapshot IBGE ${snapshot.meta.ibgeCode} ≠ ${ibge}`);
    }
    return loadCnesSnapshot(this.prisma, snapshot, {
      activeOnly,
      source: 'snapshot',
      snapshotPath: path,
      gestao,
    });
  }

  private async syncFromLive(
    ibge: string,
    activeOnly: boolean | undefined,
    gestao: CnesSyncGestao,
  ): Promise<CnesSyncResult> {
    const snapshot = await fetchLiveCnesSnapshot(ibge);
    return loadCnesSnapshot(this.prisma, snapshot, { activeOnly, source: 'live', gestao });
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertIbgeCode } from '../ledi/ibge';
import { RF } from '../common/rf';
import { fetchLiveCnesSnapshot } from './cnes.fetch';
import { loadCnesSnapshot } from './cnes.loader';
import { loadBundledSnapshot } from './cnes.snapshot';
import type { CnesSyncResult, CnesSyncSource } from './cnes.types';

@Injectable()
export class CnesService {
  private readonly log = new Logger(CnesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sync(opts: {
    ibge?: string;
    source?: CnesSyncSource;
    activeOnly?: boolean;
  }): Promise<CnesSyncResult> {
    let ibge: string;
    try {
      ibge = assertIbgeCode(opts.ibge || process.env.MUNICIPIO_IBGE || '3516200') || '3516200';
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const preferred = opts.source || 'auto';
    let result: CnesSyncResult;

    if (preferred === 'snapshot') {
      result = await this.syncFromSnapshot(ibge, opts.activeOnly);
    } else if (preferred === 'live') {
      result = await this.syncFromLive(ibge, opts.activeOnly);
    } else {
      try {
        result = await this.syncFromLive(ibge, opts.activeOnly);
      } catch (err) {
        this.log.warn(`CNES live falhou (${(err as Error).message}); usando snapshot versionado`);
        result = await this.syncFromSnapshot(ibge, opts.activeOnly);
      }
    }

    await this.prisma.audit('sync', 'cnes', ibge, [RF.CNES_SYNC.id, RF.FACILITY_LIST.id, RF.TEAM.id], {
      source: result.source,
      facilities: result.facilities,
      teams: result.teams,
    });
    return result;
  }

  private async syncFromSnapshot(ibge: string, activeOnly?: boolean): Promise<CnesSyncResult> {
    const { snapshot, path } = loadBundledSnapshot(ibge);
    if (snapshot.meta.ibgeCode !== ibge) {
      throw new BadRequestException(`snapshot IBGE ${snapshot.meta.ibgeCode} ≠ ${ibge}`);
    }
    return loadCnesSnapshot(this.prisma, snapshot, {
      activeOnly,
      source: 'snapshot',
      snapshotPath: path,
    });
  }

  private async syncFromLive(ibge: string, activeOnly?: boolean): Promise<CnesSyncResult> {
    const snapshot = await fetchLiveCnesSnapshot(ibge);
    return loadCnesSnapshot(this.prisma, snapshot, { activeOnly, source: 'live' });
  }
}

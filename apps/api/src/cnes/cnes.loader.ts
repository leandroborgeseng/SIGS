import { PrismaClient } from '@prisma/client';
import type { CnesSnapshot, CnesSyncGestao, CnesSyncResult } from './cnes.types';
import {
  applyGestaoFilter,
  isMunicipalPrefeituraNetwork,
  resolveFacilityCnpj,
  type CnesFilterStats,
} from './cnes.filter';

type Db = Pick<PrismaClient, 'facility' | 'team'>;

export async function loadCnesSnapshot(
  prisma: Db,
  snapshot: CnesSnapshot,
  opts?: {
    activeOnly?: boolean;
    source?: 'live' | 'snapshot';
    snapshotPath?: string;
    gestao?: CnesSyncGestao;
  },
): Promise<CnesSyncResult> {
  const gestao = opts?.gestao || 'municipal';
  const { snapshot: filtered, filter } = applyGestaoFilter(snapshot, gestao);
  const activeOnly = !!opts?.activeOnly;
  const establishments = activeOnly
    ? filtered.establishments.filter((e) => e.active)
    : filtered.establishments;

  const facilities = { created: 0, updated: 0, skipped: 0 };
  const cnesToId = new Map<string, string>();
  const municipalCnes = new Set(
    (gestao === 'municipal'
      ? filtered.establishments
      : filtered.establishments.filter((e) => isMunicipalPrefeituraNetwork(e))
    ).map((e) => e.cnes),
  );

  for (const est of establishments) {
    const isMunicipal = municipalCnes.has(est.cnes);
    const data = {
      name: est.name,
      active: est.active,
      cnpj: resolveFacilityCnpj({ ...est, municipalNetwork: isMunicipal }),
      typeId: est.typeId || null,
      ibgeCode: est.ibgeCode,
      municipalNetwork: isMunicipal,
      naturezaJuridica: est.naturezaJuridica || null,
      addressStreet: est.address?.street || null,
      addressNumber: est.address?.number || null,
      addressNeighborhood: est.address?.neighborhood || null,
      addressCity: est.address?.city || null,
      addressState: est.address?.state || null,
      addressZip: est.address?.zip || null,
    };

    const existing = await prisma.facility.findUnique({ where: { cnes: est.cnes } });
    if (!existing) {
      const row = await prisma.facility.create({ data: { cnes: est.cnes, ...data } });
      cnesToId.set(est.cnes, row.id);
      facilities.created += 1;
      continue;
    }

    const changed =
      existing.name !== data.name ||
      existing.active !== data.active ||
      (existing.cnpj || null) !== data.cnpj ||
      (existing.typeId || null) !== data.typeId ||
      (existing.ibgeCode || null) !== data.ibgeCode ||
      Boolean(existing.municipalNetwork) !== data.municipalNetwork ||
      (existing.naturezaJuridica || null) !== data.naturezaJuridica ||
      (existing.addressStreet || null) !== data.addressStreet ||
      (existing.addressNumber || null) !== data.addressNumber ||
      (existing.addressNeighborhood || null) !== data.addressNeighborhood ||
      (existing.addressCity || null) !== data.addressCity ||
      (existing.addressState || null) !== data.addressState ||
      (existing.addressZip || null) !== data.addressZip;

    if (changed) {
      await prisma.facility.update({ where: { id: existing.id }, data });
      facilities.updated += 1;
    } else {
      facilities.skipped += 1;
    }
    cnesToId.set(est.cnes, existing.id);
  }

  // Após sync municipal: desmarcar demais CNES do mesmo IBGE (lista UI não mostra cidade inteira)
  const ibgeCode = snapshot.meta.ibgeCode;
  if (gestao === 'municipal' && ibgeCode && typeof prisma.facility.updateMany === 'function') {
    const municipalList = [...municipalCnes];
    await prisma.facility.updateMany({
      where: {
        ibgeCode,
        ...(municipalList.length ? { cnes: { notIn: municipalList } } : {}),
      },
      data: { municipalNetwork: false },
    });
  }

  // Resolve facility ids for teams even if establishment was filtered out (activeOnly)
  const teamsCounter = { created: 0, updated: 0, skipped: 0 };
  for (const team of filtered.teams) {
    let facilityId = cnesToId.get(team.cnes);
    if (!facilityId) {
      const fac = await prisma.facility.findUnique({ where: { cnes: team.cnes } });
      if (!fac) {
        teamsCounter.skipped += 1;
        continue;
      }
      facilityId = fac.id;
      cnesToId.set(team.cnes, facilityId);
    }

    const data = {
      facilityId,
      name: team.name,
      teamTypeId: team.teamTypeId,
      active: team.active !== false,
      ine: team.ine,
    };

    const existing = await prisma.team.findUnique({ where: { ine: team.ine } });
    if (!existing) {
      await prisma.team.create({ data });
      teamsCounter.created += 1;
      continue;
    }

    const changed =
      existing.facilityId !== data.facilityId ||
      existing.name !== data.name ||
      existing.teamTypeId !== data.teamTypeId ||
      existing.active !== data.active;

    if (changed) {
      await prisma.team.update({ where: { id: existing.id }, data });
      teamsCounter.updated += 1;
    } else {
      teamsCounter.skipped += 1;
    }
  }

  return buildSyncResult({
    ibgeCode: snapshot.meta.ibgeCode,
    source: opts?.source || 'snapshot',
    gestao,
    filter,
    facilities,
    teams: teamsCounter,
    snapshotPath: opts?.snapshotPath,
  });
}

export function buildSyncResult(args: {
  ibgeCode: string;
  source: 'live' | 'snapshot';
  gestao: CnesSyncGestao;
  filter: CnesFilterStats;
  facilities: { created: number; updated: number; skipped: number };
  teams: { created: number; updated: number; skipped: number };
  snapshotPath?: string;
}): CnesSyncResult {
  return {
    ibgeCode: args.ibgeCode,
    source: args.source,
    gestao: args.gestao,
    filter: args.filter,
    facilities: args.facilities,
    teams: args.teams,
    totals: {
      establishments: args.filter.after.establishments,
      teams: args.filter.after.teams,
      establishmentsActive: args.filter.after.establishmentsActive,
      establishmentsCity: args.filter.before.establishments,
      teamsCity: args.filter.before.teams,
    },
    snapshotPath: args.snapshotPath,
  };
}

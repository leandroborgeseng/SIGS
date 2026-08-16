import { PrismaClient } from '@prisma/client';
import type { CnesSnapshot, CnesSyncResult } from './cnes.types';

type Db = Pick<PrismaClient, 'facility' | 'team'>;

export async function loadCnesSnapshot(
  prisma: Db,
  snapshot: CnesSnapshot,
  opts?: { activeOnly?: boolean; source?: 'live' | 'snapshot'; snapshotPath?: string },
): Promise<CnesSyncResult> {
  const activeOnly = !!opts?.activeOnly;
  const establishments = activeOnly
    ? snapshot.establishments.filter((e) => e.active)
    : snapshot.establishments;

  const facilities = { created: 0, updated: 0, skipped: 0 };
  const cnesToId = new Map<string, string>();

  for (const est of establishments) {
    const data = {
      name: est.name,
      active: est.active,
      cnpj: est.cnpj || null,
      typeId: est.typeId || null,
      ibgeCode: est.ibgeCode,
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

  // Resolve facility ids for teams even if establishment was filtered out (activeOnly)
  const teamsCounter = { created: 0, updated: 0, skipped: 0 };
  for (const team of snapshot.teams) {
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

  return {
    ibgeCode: snapshot.meta.ibgeCode,
    source: opts?.source || 'snapshot',
    facilities,
    teams: teamsCounter,
    totals: {
      establishments: snapshot.establishments.length,
      teams: snapshot.teams.length,
      establishmentsActive:
        snapshot.meta.counts?.establishmentsActive ??
        snapshot.establishments.filter((e) => e.active).length,
    },
    snapshotPath: opts?.snapshotPath,
  };
}

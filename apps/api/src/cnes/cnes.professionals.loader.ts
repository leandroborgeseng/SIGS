import { PrismaClient } from '@prisma/client';
import type {
  CnesProfessionalsSnapshot,
  CnesProfessionalsSyncResult,
} from './cnes.professionals.types';
import { padCnes, padIne } from './cnes.parser';

type Db = Pick<PrismaClient, 'professional' | 'professionalAssignment' | 'facility' | 'team'>;

function normalizeCns(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export async function loadCnesProfessionalsSnapshot(
  prisma: Db,
  snapshot: CnesProfessionalsSnapshot,
  opts?: { source?: 'snapshot' | 'live'; snapshotPath?: string },
): Promise<CnesProfessionalsSyncResult> {
  const professionals = { created: 0, updated: 0, skipped: 0 };
  const assignments = { created: 0, updated: 0, skipped: 0 };
  const cnsToId = new Map<string, string>();

  for (const row of snapshot.professionals) {
    const cns = normalizeCns(row.cns);
    if (cns.length !== 15) {
      professionals.skipped += 1;
      continue;
    }
    const civilName = String(row.civilName || `CNS ${cns}`).trim();
    const existing = await prisma.professional.findFirst({ where: { cns } });
    if (!existing) {
      const created = await prisma.professional.create({
        data: { civilName, cns },
      });
      cnsToId.set(cns, created.id);
      professionals.created += 1;
      continue;
    }
    if (existing.civilName !== civilName) {
      await prisma.professional.update({
        where: { id: existing.id },
        data: { civilName },
      });
      professionals.updated += 1;
    } else {
      professionals.skipped += 1;
    }
    cnsToId.set(cns, existing.id);
  }

  // Cache facilities/teams by CNES/INE
  const facilities = await prisma.facility.findMany({
    select: { id: true, cnes: true },
  });
  const facilityByCnes = new Map(
    facilities.map((f) => [padCnes(f.cnes) || f.cnes, f.id] as const),
  );
  const teams = await prisma.team.findMany({
    select: { id: true, ine: true, facilityId: true },
  });
  const teamByIne = new Map(
    teams
      .filter((t) => t.ine)
      .map((t) => [padIne(t.ine) || t.ine!, t] as const),
  );

  for (const asg of snapshot.assignments) {
    const cns = normalizeCns(asg.cns);
    const cnes = padCnes(asg.cnes);
    const ine = padIne(asg.ine);
    const cbo = String(asg.cbo || '').replace(/\D/g, '');
    if (!cns || !cnes || !cbo || cbo.length < 4) {
      assignments.skipped += 1;
      continue;
    }
    let professionalId = cnsToId.get(cns);
    if (!professionalId) {
      const prof = await prisma.professional.findFirst({ where: { cns } });
      if (!prof) {
        assignments.skipped += 1;
        continue;
      }
      professionalId = prof.id;
      cnsToId.set(cns, professionalId);
    }
    const facilityId = facilityByCnes.get(cnes);
    if (!facilityId) {
      assignments.skipped += 1;
      continue;
    }
    const team = ine ? teamByIne.get(ine) : undefined;
    if (team && team.facilityId !== facilityId) {
      // INE aponta outra unidade — ainda cria lotação na facility do CNES sem team
    }
    const teamId = team && team.facilityId === facilityId ? team.id : null;

    const existing = await prisma.professionalAssignment.findFirst({
      where: {
        professionalId,
        facilityId,
        cbo,
        teamId: teamId || null,
        active: true,
      },
    });

    if (!existing) {
      await prisma.professionalAssignment.create({
        data: {
          professionalId,
          facilityId,
          teamId,
          cbo,
          roleLabel: asg.roleLabel || null,
          active: asg.active !== false,
        },
      });
      assignments.created += 1;
      continue;
    }

    const nextRole = asg.roleLabel || null;
    if ((existing.roleLabel || null) !== nextRole) {
      await prisma.professionalAssignment.update({
        where: { id: existing.id },
        data: { roleLabel: nextRole },
      });
      assignments.updated += 1;
    } else {
      assignments.skipped += 1;
    }
  }

  return {
    ibgeCode: snapshot.meta.ibgeCode || '3516200',
    source: opts?.source || 'snapshot',
    professionals,
    assignments,
    totals: {
      professionals: snapshot.professionals.length,
      assignments: snapshot.assignments.length,
      teamsQueried: snapshot.meta.counts?.teamsQueried,
    },
    snapshotPath: opts?.snapshotPath,
  };
}

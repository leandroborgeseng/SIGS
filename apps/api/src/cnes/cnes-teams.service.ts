import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  applyGestaoFilter,
  parseGestaoMode,
  PREFEITURA_FRANCA_CNPJ,
} from './cnes.filter';
import { loadBundledSnapshot } from './cnes.snapshot';
import { listKnownTeamTypes, resolveTeamTypeLabel } from './team-type-catalog';
import type { CnesSyncGestao } from './cnes.types';

export type CnesTeamListItem = {
  id: string;
  name: string;
  ine: string | null;
  teamTypeId: string;
  teamTypeLabel: string;
  active: boolean;
  memberCount: number;
  hasMembers: boolean;
  facility: {
    id: string;
    name: string;
    cnes: string | null;
    municipalNetwork: boolean;
  };
};

export type CnesTeamMember = {
  assignmentId: string;
  professionalId: string;
  name: string;
  cns: string | null;
  cbo: string;
  cboLabel: string;
  roleLabel: string | null;
  active: boolean;
  startedAt: string;
};

export type CnesTeamDetail = CnesTeamListItem & {
  members: CnesTeamMember[];
};

export type MultiTeamProfessional = {
  professionalId: string;
  name: string;
  cns: string | null;
  teamCount: number;
  teams: Array<{
    teamId: string;
    teamName: string;
    ine: string | null;
    teamTypeId: string;
    teamTypeLabel: string;
    facilityName: string;
    facilityCnes: string | null;
    cbo: string;
    cboLabel: string;
  }>;
};

@Injectable()
export class CnesTeamsService {
  constructor(private readonly prisma: PrismaService) {}

  teamTypesCatalog() {
    return {
      source: 'snapshot Franca 3516200 (teamTypeLabel CnesWeb) + fallback',
      types: listKnownTeamTypes(),
    };
  }

  async listTeams(opts: {
    ibge?: string;
    gestao?: string;
    q?: string;
    teamTypeId?: string;
    activeOnly?: boolean;
    facilityId?: string;
  }): Promise<{
    ibgeCode: string;
    gestao: CnesSyncGestao;
    counts: { teams: number; withMembers: number; withoutMembers: number };
    teams: CnesTeamListItem[];
  }> {
    const ibgeCode = (opts.ibge || '3516200').replace(/\D/g, '') || '3516200';
    const gestao = parseGestaoMode(opts.gestao);
    const where = this.teamWhere(ibgeCode, gestao, opts);

    const rows = await this.prisma.team.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            cnes: true,
            municipalNetwork: true,
          },
        },
        _count: {
          select: {
            assignments: { where: { active: true } },
          },
        },
      },
    });

    const teams: CnesTeamListItem[] = rows.map((t) => {
      const memberCount = t._count.assignments;
      return {
        id: t.id,
        name: t.name,
        ine: t.ine,
        teamTypeId: t.teamTypeId,
        teamTypeLabel: resolveTeamTypeLabel(t.teamTypeId),
        active: t.active,
        memberCount,
        hasMembers: memberCount > 0,
        facility: t.facility,
      };
    });

    const withMembers = teams.filter((t) => t.hasMembers).length;
    return {
      ibgeCode,
      gestao,
      counts: {
        teams: teams.length,
        withMembers,
        withoutMembers: teams.length - withMembers,
      },
      teams,
    };
  }

  async getTeam(id: string): Promise<CnesTeamDetail> {
    const row = await this.prisma.team.findUnique({
      where: { id },
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            cnes: true,
            municipalNetwork: true,
          },
        },
        assignments: {
          where: { active: true },
          orderBy: [{ professional: { civilName: 'asc' } }],
          include: {
            professional: {
              select: {
                id: true,
                civilName: true,
                socialName: true,
                cns: true,
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Equipe não encontrada');

    const members: CnesTeamMember[] = row.assignments.map((a) => {
      const name = a.professional.socialName || a.professional.civilName;
      const cboLabel = a.roleLabel?.trim() || `CBO ${a.cbo}`;
      return {
        assignmentId: a.id,
        professionalId: a.professional.id,
        name,
        cns: a.professional.cns,
        cbo: a.cbo,
        cboLabel,
        roleLabel: a.roleLabel,
        active: a.active,
        startedAt: a.startedAt.toISOString(),
      };
    });

    return {
      id: row.id,
      name: row.name,
      ine: row.ine,
      teamTypeId: row.teamTypeId,
      teamTypeLabel: resolveTeamTypeLabel(row.teamTypeId),
      active: row.active,
      memberCount: members.length,
      hasMembers: members.length > 0,
      facility: row.facility,
      members,
    };
  }

  async listMultiTeamProfessionals(opts: {
    ibge?: string;
    gestao?: string;
  }): Promise<{
    ibgeCode: string;
    gestao: CnesSyncGestao;
    counts: { professionals: number };
    professionals: MultiTeamProfessional[];
  }> {
    const ibgeCode = (opts.ibge || '3516200').replace(/\D/g, '') || '3516200';
    const gestao = parseGestaoMode(opts.gestao);
    const facilityWhere = this.facilityScope(ibgeCode, gestao);

    const assignments = await this.prisma.professionalAssignment.findMany({
      where: {
        active: true,
        teamId: { not: null },
        facility: facilityWhere,
      },
      include: {
        professional: {
          select: { id: true, civilName: true, socialName: true, cns: true },
        },
        team: {
          select: {
            id: true,
            name: true,
            ine: true,
            teamTypeId: true,
            facility: { select: { name: true, cnes: true } },
          },
        },
      },
      orderBy: [{ professional: { civilName: 'asc' } }],
    });

    type Acc = {
      professionalId: string;
      name: string;
      cns: string | null;
      byTeam: Map<
        string,
        {
          teamId: string;
          teamName: string;
          ine: string | null;
          teamTypeId: string;
          teamTypeLabel: string;
          facilityName: string;
          facilityCnes: string | null;
          cbo: string;
          cboLabel: string;
        }
      >;
    };

    const byProf = new Map<string, Acc>();
    for (const a of assignments) {
      if (!a.team || !a.teamId) continue;
      let acc = byProf.get(a.professionalId);
      if (!acc) {
        acc = {
          professionalId: a.professional.id,
          name: a.professional.socialName || a.professional.civilName,
          cns: a.professional.cns,
          byTeam: new Map(),
        };
        byProf.set(a.professionalId, acc);
      }
      if (!acc.byTeam.has(a.teamId)) {
        acc.byTeam.set(a.teamId, {
          teamId: a.team.id,
          teamName: a.team.name,
          ine: a.team.ine,
          teamTypeId: a.team.teamTypeId,
          teamTypeLabel: resolveTeamTypeLabel(a.team.teamTypeId),
          facilityName: a.team.facility.name,
          facilityCnes: a.team.facility.cnes,
          cbo: a.cbo,
          cboLabel: a.roleLabel?.trim() || `CBO ${a.cbo}`,
        });
      }
    }

    const professionals: MultiTeamProfessional[] = [...byProf.values()]
      .filter((p) => p.byTeam.size > 1)
      .map((p) => ({
        professionalId: p.professionalId,
        name: p.name,
        cns: p.cns,
        teamCount: p.byTeam.size,
        teams: [...p.byTeam.values()].sort((a, b) =>
          a.teamName.localeCompare(b.teamName, 'pt-BR'),
        ),
      }))
      .sort((a, b) => b.teamCount - a.teamCount || a.name.localeCompare(b.name, 'pt-BR'));

    return {
      ibgeCode,
      gestao,
      counts: { professionals: professionals.length },
      professionals,
    };
  }

  /** Export CSV rede municipal: linhas unidade × equipe × profissional (ou só equipe se sem PF). */
  async exportNetwork(opts: {
    ibge?: string;
    gestao?: string;
  }): Promise<{
    ibgeCode: string;
    gestao: CnesSyncGestao;
    generatedAt: string;
    filename: string;
    rowCount: number;
    csv: string;
  }> {
    const ibgeCode = (opts.ibge || '3516200').replace(/\D/g, '') || '3516200';
    const gestao = parseGestaoMode(opts.gestao);
    const facilityWhere = this.facilityScope(ibgeCode, gestao);

    const teams = await this.prisma.team.findMany({
      where: { active: true, facility: facilityWhere },
      orderBy: [{ name: 'asc' }],
      include: {
        facility: { select: { name: true, cnes: true } },
        assignments: {
          where: { active: true },
          include: {
            professional: {
              select: { civilName: true, socialName: true, cns: true },
            },
          },
        },
      },
    });

    const header = [
      'facility_cnes',
      'facility_name',
      'team_ine',
      'team_name',
      'team_type_id',
      'team_type_label',
      'professional_name',
      'professional_cns',
      'cbo',
      'cbo_label',
    ];
    const lines: string[] = [header.join(';')];

    const esc = (v: string | null | undefined) => {
      const s = (v ?? '').replace(/"/g, '""');
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    for (const t of teams) {
      const typeLabel = resolveTeamTypeLabel(t.teamTypeId);
      if (!t.assignments.length) {
        lines.push(
          [
            esc(t.facility.cnes),
            esc(t.facility.name),
            esc(t.ine),
            esc(t.name),
            esc(t.teamTypeId),
            esc(typeLabel),
            '',
            '',
            '',
            '',
          ].join(';'),
        );
        continue;
      }
      for (const a of t.assignments) {
        const name = a.professional.socialName || a.professional.civilName;
        lines.push(
          [
            esc(t.facility.cnes),
            esc(t.facility.name),
            esc(t.ine),
            esc(t.name),
            esc(t.teamTypeId),
            esc(typeLabel),
            esc(name),
            esc(a.professional.cns),
            esc(a.cbo),
            esc(a.roleLabel?.trim() || `CBO ${a.cbo}`),
          ].join(';'),
        );
      }
    }

    const generatedAt = new Date().toISOString();
    return {
      ibgeCode,
      gestao,
      generatedAt,
      filename: `cnes-rede-${ibgeCode}-${generatedAt.slice(0, 10)}.csv`,
      rowCount: lines.length - 1,
      csv: lines.join('\n') + '\n',
    };
  }

  private teamWhere(
    ibgeCode: string,
    gestao: CnesSyncGestao,
    opts: { q?: string; teamTypeId?: string; activeOnly?: boolean; facilityId?: string },
  ): Prisma.TeamWhereInput {
    const and: Prisma.TeamWhereInput[] = [{ facility: this.facilityScope(ibgeCode, gestao) }];
    if (opts.facilityId) and.push({ facilityId: opts.facilityId });
    if (opts.teamTypeId) and.push({ teamTypeId: opts.teamTypeId.trim() });
    if (opts.activeOnly) and.push({ active: true });
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      and.push({
        OR: [
          { name: { contains: q } },
          { ine: { contains: q } },
          { facility: { name: { contains: q } } },
          { facility: { cnes: { contains: q } } },
        ],
      });
    }
    return { AND: and };
  }

  private facilityScope(ibgeCode: string, gestao: CnesSyncGestao): Prisma.FacilityWhereInput {
    if (gestao === 'todos') {
      return ibgeCode ? { ibgeCode } : {};
    }
    const cnesFromSnapshot = this.municipalCnesFromSnapshot(ibgeCode);
    if (cnesFromSnapshot?.length) {
      return {
        AND: [
          ibgeCode ? { ibgeCode } : {},
          {
            OR: [{ municipalNetwork: true }, { cnes: { in: cnesFromSnapshot } }],
          },
        ],
      };
    }
    return {
      AND: [
        ibgeCode ? { ibgeCode } : {},
        {
          OR: [
            { municipalNetwork: true },
            { cnpj: PREFEITURA_FRANCA_CNPJ },
            { naturezaJuridica: '1244' },
          ],
        },
      ],
    };
  }

  private municipalCnesFromSnapshot(ibgeCode: string): string[] | null {
    try {
      const { snapshot } = loadBundledSnapshot(ibgeCode);
      const { snapshot: muni } = applyGestaoFilter(snapshot, 'municipal');
      return muni.establishments.map((e) => e.cnes);
    } catch {
      return null;
    }
  }
}

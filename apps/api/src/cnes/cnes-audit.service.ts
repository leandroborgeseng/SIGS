import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FRANCA_IBGE,
  isValidCnesFormat,
  loadBundledSnapshot,
  normalizeCnes,
  normalizeIne,
  teamFacilityTypeMismatch,
} from './cnes.snapshot';
import { applyGestaoFilter, CNES_GESTAO_CRITERION } from './cnes.filter';
import type { CnesSyncGestao } from './cnes.types';

export type CnesAuditSeverity = 'error' | 'warn' | 'info';

export type CnesAuditCode =
  | 'TEAM_WITHOUT_FACILITY'
  | 'TEAM_WITHOUT_MEMBERS'
  | 'FACILITY_WITHOUT_TEAM'
  | 'INE_DUPLICATE'
  | 'INE_CNES_OTHER_IBGE'
  | 'TEAM_FACILITY_TYPE_MISMATCH'
  | 'SNAPSHOT_INACTIVE_SIGS_ACTIVE'
  | 'CNES_FORMAT_INVALID'
  | 'FACILITY_IBGE_MISMATCH'
  | 'PATIENT_TEAM_LINK_ORPHAN'
  | 'ASSIGNMENT_INE_MISSING'
  | 'LEDI_CNES_INE_ALERT';

export type CnesAuditFinding = {
  code: CnesAuditCode;
  severity: CnesAuditSeverity;
  message: string;
  entityType: 'facility' | 'team' | 'patient_team_link' | 'assignment' | 'production' | 'snapshot';
  entityId?: string | null;
  cnes?: string | null;
  ine?: string | null;
  ibgeCode?: string | null;
  details?: Record<string, unknown>;
};

export type CnesAuditInventoryRow = {
  id: string;
  name: string;
  cnes?: string | null;
  ine?: string | null;
  active: boolean;
  typeId?: string | null;
  teamCount?: number;
  facilityName?: string | null;
};

export type CnesAuditReport = {
  ibgeCode: string;
  generatedAt: string;
  snapshotPath?: string;
  snapshotMeta?: Record<string, unknown>;
  gestao: CnesSyncGestao;
  gestaoCriterion: string;
  /** true quando o banco municipal está vazio — UI deve pedir sync CNES */
  needsSync: boolean;
  counts: {
    findings: number;
    bySeverity: Record<CnesAuditSeverity, number>;
    byCode: Partial<Record<CnesAuditCode, number>>;
    facilitiesInScope: number;
    teamsInScope: number;
    snapshotEstablishments?: number;
    snapshotTeams?: number;
    snapshotEstablishmentsCity?: number;
    snapshotTeamsCity?: number;
  };
  /** Amostra do cadastro SIGS (após sync) — evita tela só com findings vazios */
  inventory: {
    facilities: CnesAuditInventoryRow[];
    teams: CnesAuditInventoryRow[];
  };
  findings: CnesAuditFinding[];
  heuristics: {
    teamFacilityType: string;
  };
};

@Injectable()
export class CnesAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async audit(
    opts: { ibgeCode?: string; includeLedi?: boolean; gestao?: CnesSyncGestao } = {},
  ): Promise<CnesAuditReport> {
    const ibgeCode = (opts.ibgeCode || FRANCA_IBGE).replace(/\D/g, '');
    if (!/^\d{7}$/.test(ibgeCode)) {
      throw new BadRequestException('ibge deve ter 7 dígitos');
    }
    const gestao = opts.gestao || 'municipal';

    let snapshotPath: string | undefined;
    let snapshotMeta: Record<string, unknown> | undefined;
    let snapshotEstablishments = 0;
    let snapshotTeams = 0;
    let snapshotEstablishmentsCity = 0;
    let snapshotTeamsCity = 0;
    let snapByCnes = new Map<string, { active: boolean; typeId?: string | null; ibgeCode: string }>();
    let snapByIne = new Map<
      string,
      { cnes: string; active: boolean; teamTypeId: string; name: string }
    >();

    try {
      const loaded = loadBundledSnapshot(ibgeCode);
      snapshotPath = loaded.path;
      const { snapshot: scoped, filter } = applyGestaoFilter(loaded.snapshot, gestao);
      snapshotMeta = {
        ...(loaded.snapshot.meta as unknown as Record<string, unknown>),
        gestaoFilter: filter.mode,
        gestaoCriterion: filter.criterion,
      };
      snapshotEstablishmentsCity = filter.before.establishments;
      snapshotTeamsCity = filter.before.teams;
      snapshotEstablishments = filter.after.establishments;
      snapshotTeams = filter.after.teams;
      for (const e of scoped.establishments) {
        const cnes = normalizeCnes(e.cnes) || e.cnes;
        snapByCnes.set(cnes, { active: e.active, typeId: e.typeId, ibgeCode: e.ibgeCode });
      }
      for (const t of scoped.teams) {
        const ine = normalizeIne(t.ine) || t.ine;
        snapByIne.set(ine, {
          cnes: normalizeCnes(t.cnes) || t.cnes,
          active: t.active !== false,
          teamTypeId: t.teamTypeId,
          name: t.name,
        });
      }
    } catch {
      // auditoria ainda funciona só com SIGS; findings de snapshot ficam limitados
    }

    const findings: CnesAuditFinding[] = [];

    const facilities = await this.prisma.facility.findMany({
      include: { _count: { select: { teams: true } } },
    });
    const teams = await this.prisma.team.findMany({
      include: {
        facility: true,
        _count: { select: { assignments: { where: { active: true } } } },
      },
    });

    // Escopo: com gestao=municipal, só CNES presentes no snapshot filtrado (rede Prefeitura).
    // Com gestao=todos, IBGE pedido OU presente no snapshot OU sem IBGE (para detectar).
    const facilitiesInScope = facilities.filter((f) => {
      if (gestao === 'municipal') {
        return snapByCnes.size === 0
          ? !f.ibgeCode || f.ibgeCode === ibgeCode
          : snapByCnes.has(normalizeCnes(f.cnes) || f.cnes);
      }
      return !f.ibgeCode || f.ibgeCode === ibgeCode || snapByCnes.has(f.cnes);
    });
    const teamsInScope = teams.filter((t) => {
      const facCnes = normalizeCnes(t.facility.cnes) || t.facility.cnes;
      const ine = t.ine ? normalizeIne(t.ine) || t.ine : null;
      if (gestao === 'municipal') {
        if (snapByCnes.size === 0 && snapByIne.size === 0) {
          return !t.facility.ibgeCode || t.facility.ibgeCode === ibgeCode;
        }
        return snapByCnes.has(facCnes) || (!!ine && snapByIne.has(ine));
      }
      return (
        !t.facility.ibgeCode ||
        t.facility.ibgeCode === ibgeCode ||
        snapByCnes.has(facCnes) ||
        (!!ine && snapByIne.has(ine))
      );
    });

    // CNES formato inválido
    for (const f of facilities) {
      if (!isValidCnesFormat(f.cnes)) {
        findings.push({
          code: 'CNES_FORMAT_INVALID',
          severity: 'error',
          message: `CNES "${f.cnes}" não tem 7 dígitos úteis`,
          entityType: 'facility',
          entityId: f.id,
          cnes: f.cnes,
          ibgeCode: f.ibgeCode,
        });
      }
    }

    // IBGE ≠ município alvo
    for (const f of facilities) {
      if (f.ibgeCode && f.ibgeCode !== ibgeCode) {
        findings.push({
          code: 'FACILITY_IBGE_MISMATCH',
          severity: 'warn',
          message: `Unidade com IBGE ${f.ibgeCode} (esperado ${ibgeCode})`,
          entityType: 'facility',
          entityId: f.id,
          cnes: f.cnes,
          ibgeCode: f.ibgeCode,
        });
      }
    }

    // Estabelecimento sem equipe
    for (const f of facilitiesInScope) {
      if (f._count.teams === 0) {
        findings.push({
          code: 'FACILITY_WITHOUT_TEAM',
          severity: f.active ? 'warn' : 'info',
          message: `Estabelecimento sem nenhuma equipe`,
          entityType: 'facility',
          entityId: f.id,
          cnes: f.cnes,
          ibgeCode: f.ibgeCode,
          details: { active: f.active, name: f.name },
        });
      }
    }

    // Equipe sem estabelecimento / facility órfã (defesa) + INE→CNES outro IBGE
    const ineBuckets = new Map<string, typeof teams>();
    for (const t of teams) {
      if (!t.facilityId || !t.facility) {
        findings.push({
          code: 'TEAM_WITHOUT_FACILITY',
          severity: 'error',
          message: `Equipe sem estabelecimento CNES`,
          entityType: 'team',
          entityId: t.id,
          ine: t.ine,
        });
      } else if (!t.facility.cnes) {
        findings.push({
          code: 'TEAM_WITHOUT_FACILITY',
          severity: 'error',
          message: `Equipe vinculada a unidade sem CNES`,
          entityType: 'team',
          entityId: t.id,
          ine: t.ine,
          details: { facilityId: t.facilityId },
        });
      }

      const ine = t.ine ? normalizeIne(t.ine) || t.ine : null;
      if (ine) {
        const bucket = ineBuckets.get(ine) || [];
        bucket.push(t);
        ineBuckets.set(ine, bucket);
      }

      // INE no snapshot aponta para CNES de outro município (facility.ibge ≠ alvo e ≠ snap)
      if (ine && snapByIne.has(ine)) {
        const snap = snapByIne.get(ine)!;
        const snapEst = snapByCnes.get(snap.cnes);
        if (t.facility.ibgeCode && t.facility.ibgeCode !== ibgeCode) {
          findings.push({
            code: 'INE_CNES_OTHER_IBGE',
            severity: 'error',
            message: `INE ${ine} ligado a CNES ${t.facility.cnes} com IBGE ${t.facility.ibgeCode}`,
            entityType: 'team',
            entityId: t.id,
            cnes: t.facility.cnes,
            ine,
            ibgeCode: t.facility.ibgeCode,
            details: { snapshotCnes: snap.cnes, snapshotIbge: snapEst?.ibgeCode },
          });
        }
        if (normalizeCnes(t.facility.cnes) !== snap.cnes) {
          findings.push({
            code: 'INE_CNES_OTHER_IBGE',
            severity: 'warn',
            message: `INE ${ine} no SIGS em CNES ${t.facility.cnes}, no snapshot em CNES ${snap.cnes}`,
            entityType: 'team',
            entityId: t.id,
            cnes: t.facility.cnes,
            ine,
            details: { snapshotCnes: snap.cnes },
          });
        }
      }

      // tipo equipe × tipo unidade
      if (teamFacilityTypeMismatch(t.teamTypeId, t.facility.typeId)) {
        findings.push({
          code: 'TEAM_FACILITY_TYPE_MISMATCH',
          severity: 'warn',
          message: `Tipo equipe ${t.teamTypeId} incompatível com tipo unidade ${t.facility.typeId}`,
          entityType: 'team',
          entityId: t.id,
          cnes: t.facility.cnes,
          ine: t.ine,
          details: {
            teamTypeId: t.teamTypeId,
            facilityTypeId: t.facility.typeId,
            heuristic:
              'Equipes APS (70/71/72/73/74/76) não devem estar em consultório isolado (tipo 22)',
          },
        });
      }

      // Equipe ativa sem profissionais lotados (após sync PF)
      if (t.active && (t._count?.assignments ?? 0) === 0) {
        const inScope =
          gestao === 'municipal'
            ? snapByCnes.size === 0
              ? !t.facility.ibgeCode || t.facility.ibgeCode === ibgeCode
              : snapByCnes.has(normalizeCnes(t.facility.cnes) || t.facility.cnes) ||
                (!!t.ine && snapByIne.has(normalizeIne(t.ine) || t.ine))
            : true;
        if (inScope) {
          findings.push({
            code: 'TEAM_WITHOUT_MEMBERS',
            severity: 'info',
            message: `Equipe ativa sem profissionais lotados`,
            entityType: 'team',
            entityId: t.id,
            cnes: t.facility.cnes,
            ine: t.ine,
            details: {
              name: t.name,
              teamTypeId: t.teamTypeId,
              hint: 'Importe PF via POST /v1/cnes/sync-professionals ou veja /equipes',
            },
          });
        }
      }

      // inativo no snapshot, ativo no SIGS
      const cnes = normalizeCnes(t.facility.cnes) || t.facility.cnes;
      const snapEst = snapByCnes.get(cnes);
      if (snapEst && !snapEst.active && t.facility.active) {
        findings.push({
          code: 'SNAPSHOT_INACTIVE_SIGS_ACTIVE',
          severity: 'warn',
          message: `CNES ${cnes} inativo no snapshot CNES mas ativo no SIGS`,
          entityType: 'facility',
          entityId: t.facility.id,
          cnes,
          ibgeCode: t.facility.ibgeCode,
        });
      }
      if (ine && snapByIne.has(ine)) {
        const snapT = snapByIne.get(ine)!;
        if (!snapT.active && t.active) {
          findings.push({
            code: 'SNAPSHOT_INACTIVE_SIGS_ACTIVE',
            severity: 'warn',
            message: `INE ${ine} inativo no snapshot mas ativo no SIGS`,
            entityType: 'team',
            entityId: t.id,
            cnes,
            ine,
          });
        }
      }
    }

    // Facilities inativas no snap mas ativas no SIGS (mesmo sem equipe)
    for (const f of facilities) {
      const cnes = normalizeCnes(f.cnes) || f.cnes;
      const snapEst = snapByCnes.get(cnes);
      if (snapEst && !snapEst.active && f.active) {
        const already = findings.some(
          (x) => x.code === 'SNAPSHOT_INACTIVE_SIGS_ACTIVE' && x.entityId === f.id,
        );
        if (!already) {
          findings.push({
            code: 'SNAPSHOT_INACTIVE_SIGS_ACTIVE',
            severity: 'warn',
            message: `CNES ${cnes} inativo no snapshot CNES mas ativo no SIGS`,
            entityType: 'facility',
            entityId: f.id,
            cnes,
            ibgeCode: f.ibgeCode,
          });
        }
      }
    }

    // INE duplicado
    for (const [ine, rows] of ineBuckets) {
      if (rows.length > 1) {
        findings.push({
          code: 'INE_DUPLICATE',
          severity: 'error',
          message: `INE ${ine} duplicado em ${rows.length} equipes`,
          entityType: 'team',
          ine,
          details: { teamIds: rows.map((r) => r.id), cnesList: rows.map((r) => r.facility.cnes) },
        });
      }
    }

    // Vínculos paciente-equipe órfãos (equipe inexistente ou inativa com link ativo)
    const links = await this.prisma.patientTeamLink.findMany({
      where: { active: true },
      include: { team: true },
      take: 5000,
    });
    for (const link of links) {
      if (!link.team) {
        findings.push({
          code: 'PATIENT_TEAM_LINK_ORPHAN',
          severity: 'error',
          message: `Vínculo paciente-equipe órfão (equipe inexistente)`,
          entityType: 'patient_team_link',
          entityId: link.id,
          details: { teamId: link.teamId, patientId: link.patientId },
        });
      } else if (!link.team.active) {
        findings.push({
          code: 'PATIENT_TEAM_LINK_ORPHAN',
          severity: 'warn',
          message: `Vínculo ativo para equipe inativa`,
          entityType: 'patient_team_link',
          entityId: link.id,
          ine: link.team.ine,
          details: { teamId: link.teamId, patientId: link.patientId },
        });
      }
    }

    // Assignment com equipe cujo INE não existe no cadastro municipal / snapshot
    const assignments = await this.prisma.professionalAssignment.findMany({
      where: { active: true, teamId: { not: null } },
      include: { team: true, facility: true },
      take: 5000,
    });
    for (const a of assignments) {
      if (!a.team) {
        findings.push({
          code: 'ASSIGNMENT_INE_MISSING',
          severity: 'error',
          message: `Lotação ativa com teamId inexistente`,
          entityType: 'assignment',
          entityId: a.id,
          details: { teamId: a.teamId },
        });
        continue;
      }
      const ine = a.team.ine ? normalizeIne(a.team.ine) || a.team.ine : null;
      if (!ine) {
        findings.push({
          code: 'ASSIGNMENT_INE_MISSING',
          severity: 'warn',
          message: `Lotação ativa em equipe sem INE`,
          entityType: 'assignment',
          entityId: a.id,
          cnes: a.facility.cnes,
          details: { teamId: a.team.id },
        });
      } else if (snapByIne.size > 0 && !snapByIne.has(ine)) {
        findings.push({
          code: 'ASSIGNMENT_INE_MISSING',
          severity: 'warn',
          message: `Lotação com INE ${ine} inexistente no snapshot CNES municipal`,
          entityType: 'assignment',
          entityId: a.id,
          cnes: a.facility.cnes,
          ine,
        });
      }
    }

    // Opcional: alertas LEDI recentes com CNES/INE (ProductionRecord — sem PHI)
    if (opts.includeLedi !== false) {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const records = await this.prisma.productionRecord.findMany({
        where: { updatedAt: { gte: since } },
        select: {
          id: true,
          facilityCnes: true,
          ine: true,
          fichaTipo: true,
          updatedAt: true,
        },
        take: 300,
        orderBy: { updatedAt: 'desc' },
      });
      for (const r of records) {
        const cnes = r.facilityCnes || '';
        const ine = r.ine || '';
        const issues: string[] = [];
        if (cnes && !isValidCnesFormat(cnes)) issues.push(`CNES inválido "${cnes}"`);
        if (ine) {
          const n = normalizeIne(ine);
          if (n && snapByIne.size > 0 && !snapByIne.has(n)) {
            issues.push(`INE ${n} fora do snapshot municipal`);
          }
        }
        if (issues.length) {
          findings.push({
            code: 'LEDI_CNES_INE_ALERT',
            severity: 'info',
            message: `Registro produção recente (${r.fichaTipo}): ${issues.join('; ')}`,
            entityType: 'production',
            entityId: r.id,
            cnes: cnes || null,
            ine: ine || null,
            details: { updatedAt: r.updatedAt },
          });
        }
      }
    }

    // Dedup similar SNAPSHOT findings already handled

    const bySeverity: Record<CnesAuditSeverity, number> = { error: 0, warn: 0, info: 0 };
    const byCode: Partial<Record<CnesAuditCode, number>> = {};
    for (const f of findings) {
      bySeverity[f.severity] += 1;
      byCode[f.code] = (byCode[f.code] || 0) + 1;
    }

    const severityRank = { error: 0, warn: 1, info: 2 };
    findings.sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] || a.code.localeCompare(b.code),
    );

    const inventoryFacilities: CnesAuditInventoryRow[] = facilitiesInScope
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 40)
      .map((f) => ({
        id: f.id,
        name: f.name,
        cnes: f.cnes,
        active: f.active,
        typeId: f.typeId,
        teamCount: f._count.teams,
      }));

    const inventoryTeams: CnesAuditInventoryRow[] = teamsInScope
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 40)
      .map((t) => ({
        id: t.id,
        name: t.name,
        cnes: t.facility.cnes,
        ine: t.ine,
        active: t.active,
        typeId: t.teamTypeId,
        facilityName: t.facility.name,
        teamCount: t._count?.assignments ?? 0,
      }));

    return {
      ibgeCode,
      generatedAt: new Date().toISOString(),
      snapshotPath,
      snapshotMeta,
      gestao,
      gestaoCriterion:
        gestao === 'municipal'
          ? CNES_GESTAO_CRITERION
          : 'sem filtro — todos os CNES do município (IBGE)',
      needsSync: facilitiesInScope.length === 0 && teamsInScope.length === 0,
      counts: {
        findings: findings.length,
        bySeverity,
        byCode,
        facilitiesInScope: facilitiesInScope.length,
        teamsInScope: teamsInScope.length,
        snapshotEstablishments: snapshotEstablishments || undefined,
        snapshotTeams: snapshotTeams || undefined,
        snapshotEstablishmentsCity: snapshotEstablishmentsCity || undefined,
        snapshotTeamsCity: snapshotTeamsCity || undefined,
      },
      inventory: {
        facilities: inventoryFacilities,
        teams: inventoryTeams,
      },
      findings,
      heuristics: {
        teamFacilityType:
          'Equipes APS (tipos 70 eSF, 71 eSB, 72 NASF, 73 eMulti, 74 eCR, 76 eAP) não devem estar em estabelecimento tipo 22 (consultório isolado). Compatíveis: 01/02 UBS/posto, 15 mista, 32/40/42 móveis, 70–74, 43 policlínica.',
      },
    };
  }
}

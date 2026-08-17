import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SigtapService } from '../sigtap/sigtap.service';
import { RF } from '../common/rf';
import {
  FRANCA_IBGE,
  isValidCnesFormat,
  loadBundledSnapshot,
  normalizeCnes,
  normalizeIne,
} from '../cnes/cnes.snapshot';
import { applyGestaoFilter, CNES_GESTAO_CRITERION } from '../cnes/cnes.filter';
import { loadProfessionalsSnapshot } from '../cnes/cnes.professionals.snapshot';
import type { CnesSyncGestao } from '../cnes/cnes.types';
import {
  appendCidadaoMasterCrossChecks,
  extractCidadaoIdsFromPayload,
  type LediCidadaoMasterCtx,
} from '../care-extra/ledi-cidadao-master';
import type { FaoFinding } from '../care-extra/ledi-fao.validator';

export type FatAuditSeverity = 'blocker' | 'quality';

export type FatAuditCode =
  | 'CNES_MISSING'
  | 'CNES_FORMAT'
  | 'CNES_NOT_IN_MUNICIPIO'
  | 'CNES_INACTIVE'
  | 'INE_MISSING'
  | 'INE_NOT_FOUND'
  | 'INE_CNES_MISMATCH'
  | 'CNS_MISSING'
  | 'CNS_NOT_LINKED'
  | 'CNS_NOT_IN_MUNICIPAL_CNES'
  | 'CBO_MISMATCH'
  | 'SIGTAP_UNKNOWN'
  | 'SIGTAP_INACTIVE'
  | 'SIGTAP_COMPETENCIA'
  | 'CIAP_FORMAT'
  | 'CONDUTA_MISSING'
  | 'FAO_CNS_NOT_IN_CADASTRO_INDIVIDUAL'
  | 'FAI_CNS_NOT_IN_CADASTRO_INDIVIDUAL'
  | 'PROC_CNS_NOT_IN_CADASTRO_INDIVIDUAL'
  | 'AD_CNS_NOT_IN_CADASTRO_INDIVIDUAL'
  | 'VISITA_CNS_NOT_IN_CADASTRO_INDIVIDUAL'
  | 'VACINA_CNS_NOT_IN_CADASTRO_INDIVIDUAL'
  | 'COLETIVO_CNS_NOT_IN_CADASTRO_INDIVIDUAL'
  | 'PROD_CNS_NOT_IN_CADASTRO_INDIVIDUAL';

export type FatAuditFinding = {
  code: FatAuditCode;
  severity: FatAuditSeverity;
  message: string;
  sourceType: 'batch' | 'production_record' | 'encounter';
  sourceId: string;
  fichaTipo?: string | null;
  cnes?: string | null;
  ine?: string | null;
  professionalCns?: string | null;
  cbo?: string | null;
  procedureCode?: string | null;
  /** Deep-link UI (fila APS/odonto, paciente, wizard lote) */
  href?: string | null;
  patientId?: string | null;
  details?: Record<string, unknown>;
};

export type FatAuditReport = {
  competencia: string;
  competenciaYm: string;
  ibgeCode: string;
  generatedAt: string;
  gestao: CnesSyncGestao;
  gestaoCriterion: string;
  counts: {
    findings: number;
    bySeverity: Record<FatAuditSeverity, number>;
    byCode: Partial<Record<FatAuditCode, number>>;
    sources: { batches: number; productionRecords: number; encounters: number };
    cnesMunicipal?: number;
    cnesCity?: number;
    teamsMunicipal?: number;
    teamsCity?: number;
  };
  findings: FatAuditFinding[];
  rfIds: string[];
};

type CadastroIndex = {
  facilityByCnes: Map<string, { id: string; active: boolean; ibgeCode: string | null; name: string }>;
  teamByIne: Map<string, { id: string; active: boolean; cnes: string; name: string }>;
  /** CNS → lotações ativas (CNES/INE/CBO) */
  assignmentsByCns: Map<
    string,
    Array<{ facilityCnes: string; ine: string | null; cbo: string; facilityId: string; teamId: string | null }>
  >;
  /** CNS presentes no snapshot PF municipal (CnesWeb) */
  municipalCnsFromPf: Set<string>;
};

type ProdUnit = {
  sourceType: FatAuditFinding['sourceType'];
  sourceId: string;
  fichaTipo: string;
  cnes: string;
  ine: string;
  professionalCns: string;
  cbo: string;
  procedureCodes: string[];
  ciaps: string[];
  hasCondutaField: boolean;
  condutaOk: boolean;
  patientId?: string;
  href?: string;
  cidadaoCns?: string;
  cidadaoCpf?: string;
};

/** Mapa kind/ficha → rota de lote ou fila. */
export function resolveFatAuditHref(opts: {
  sourceType: FatAuditFinding['sourceType'];
  sourceId: string;
  fichaTipo?: string | null;
  patientId?: string | null;
}): string {
  const tipo = String(opts.fichaTipo || '').toLowerCase();
  if (opts.sourceType === 'encounter') {
    const odonto = /fao|dental|odonto/.test(tipo);
    const base = odonto ? '/faturamento/odonto' : '/faturamento/aps';
    return `${base}?encounterId=${encodeURIComponent(opts.sourceId)}`;
  }
  if (opts.sourceType === 'production_record') {
    if (opts.patientId) return `/pacientes/${encodeURIComponent(opts.patientId)}`;
    const odonto = /fao|dental|odonto/.test(tipo);
    return odonto ? '/faturamento/odonto' : '/faturamento/aps';
  }
  // batch / productionBatch.kind
  const loteByKind: Record<string, string> = {
    individual_encounter: '/faturamento/lote/fai',
    fai: '/faturamento/lote/fai',
    dental_encounter: '/faturamento/lote/fao',
    fao: '/faturamento/lote/fao',
    procedimentos: '/faturamento/lote/proc',
    proc: '/faturamento/lote/proc',
    vaccination: '/faturamento',
    vacina: '/faturamento',
    home_care: '/faturamento/lote/ad',
    ad: '/faturamento/lote/ad',
    collective_activity: '/faturamento/lote/coletivo',
    coletivo: '/faturamento/lote/coletivo',
    cadastro_individual: '/faturamento/lote/cadastro-individual',
    cadastro_domiciliar: '/faturamento/lote/domicilio',
    visita_acs: '/faturamento/lote/visita-acs',
  };
  const path = loteByKind[tipo] || '/faturamento';
  return `${path}?batchId=${encodeURIComponent(opts.sourceId)}`;
}

const KIND_DEFAULT_PROC: Record<string, string> = {
  individual_encounter: '0301010064',
  vaccination: '0301010030',
  dental_encounter: '0101020010',
  home_care: '0101040024',
  collective_activity: '0101050011',
};

/** CIAP-2: letra + 2 dígitos (ex.: A98, T90); aceita 3º alfanumérico ocasional. */
export function isValidCiapFormat(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  return /^[A-Z][0-9]{2}[A-Z0-9]?$/.test(s);
}

export function parseCompetencia(raw?: string): { ym: string; start: Date; end: Date; display: string } {
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const cleaned = (raw || fallback).trim();
  const m = cleaned.match(/^(\d{4})-?(\d{2})$/);
  if (!m) {
    throw new BadRequestException('competencia deve ser YYYY-MM ou YYYYMM');
  }
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) {
    throw new BadRequestException('mês da competencia inválido');
  }
  const ym = `${y}${String(month).padStart(2, '0')}`;
  const display = `${y}-${String(month).padStart(2, '0')}`;
  const start = new Date(Date.UTC(y, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, month, 1, 0, 0, 0));
  return { ym, start, end, display };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function extractProcedureCodes(payload: Record<string, unknown>, kind?: string): string[] {
  const codes = new Set<string>();
  const pushCode = (c: unknown) => {
    const d = String(c ?? '').replace(/\D/g, '');
    if (d.length === 10) codes.add(d);
  };

  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const r = asRecord(node);
    if (!r) return;
    for (const key of [
      'codigoProcedimento',
      'codigo',
      'code',
      'procedimento',
      'coProcedimento',
      'procedimentos',
      'procedimentosRealizados',
    ]) {
      const v = r[key];
      if (typeof v === 'string' || typeof v === 'number') pushCode(v);
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string' || typeof item === 'number') pushCode(item);
          else {
            const ir = asRecord(item);
            if (ir) {
              pushCode(ir.codigoProcedimento || ir.codigo || ir.code || ir.coProcedimento);
            }
          }
        }
      }
    }
  };

  walk(payload);
  if (kind && KIND_DEFAULT_PROC[kind]) codes.add(KIND_DEFAULT_PROC[kind]);
  return [...codes];
}

function extractCiaps(payload: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  };
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === 'string') push(item);
        else walk(item);
      }
      return;
    }
    const r = asRecord(node);
    if (!r) return;
    if (Array.isArray(r.ciaps)) for (const c of r.ciaps) push(c);
    push(r.ciap);
    push(r.ciap2MotivoConsulta);
    if (Array.isArray(r.ciap2MotivoConsulta)) for (const c of r.ciap2MotivoConsulta) push(c);
    const problem = asRecord(r.problemaCondicaoAvaliada);
    if (problem && Array.isArray(problem.ciaps)) for (const c of problem.ciaps) push(c);
    for (const v of Object.values(r)) {
      if (v && typeof v === 'object') walk(v);
    }
  };
  walk(payload);
  return [...new Set(out)];
}

function extractConduta(payload: Record<string, unknown>, kind: string): { hasField: boolean; ok: boolean } {
  const needs =
    kind === 'individual_encounter' ||
    kind === 'FAI' ||
    kind === 'dental_encounter' ||
    kind === 'FAO' ||
    kind === 'home_care' ||
    kind === 'AD';
  if (!needs) return { hasField: false, ok: true };

  const kids =
    (payload.atendimentosIndividuais as unknown[]) ||
    (payload.atendimentosOdontologicos as unknown[]) ||
    (payload.atendimentosDomiciliares as unknown[]) ||
    [];
  const child = asRecord(Array.isArray(kids) && kids[0] ? kids[0] : null) || {};
  const condutas =
    child.condutas ||
    child.outcomes ||
    payload.condutas ||
    asRecord(payload.fichaOdontoTransport)?.condutas ||
    asRecord(payload.fichaAdTransport)?.condutaDesfecho;

  if (condutas == null) return { hasField: true, ok: false };
  if (Array.isArray(condutas)) return { hasField: true, ok: condutas.length > 0 };
  if (typeof condutas === 'number') return { hasField: true, ok: Number.isFinite(condutas) };
  if (typeof condutas === 'string') return { hasField: true, ok: condutas.trim().length > 0 };
  return { hasField: true, ok: true };
}

function headerOf(p: Record<string, unknown>) {
  return asRecord(p.headerTransport) || {};
}

function unitFromBatch(row: {
  id: string;
  kind: string;
  payloadJson: string;
}): ProdUnit | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(row.payloadJson || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
  const header = headerOf(payload);
  const lotacao = asRecord(header.lotacaoFormPrincipal) || {};
  const cnes = str(header.cnes || payload.facilityCnes || payload.cnes);
  const ine = str(header.ine || lotacao.ine || payload.ine);
  const professionalCns = str(
    header.profissionalCNS || header.cnsProfissional || lotacao.profissionalCNS || payload.professionalCns,
  );
  const cbo = str(header.cboCodigo_2002 || header.cbo || lotacao.cboCodigo_2002 || payload.cbo);
  const conduta = extractConduta(payload, row.kind);
  const cidadao = extractCidadaoIdsFromPayload(payload);
  const unit: ProdUnit = {
    sourceType: 'batch',
    sourceId: row.id,
    fichaTipo: row.kind,
    cnes,
    ine,
    professionalCns,
    cbo,
    procedureCodes: extractProcedureCodes(payload, row.kind),
    ciaps: extractCiaps(payload),
    hasCondutaField: conduta.hasField,
    condutaOk: conduta.ok,
    cidadaoCns: cidadao.cns,
    cidadaoCpf: cidadao.cpf,
  };
  unit.href = resolveFatAuditHref(unit);
  return unit;
}

function unitFromProductionRecord(row: {
  id: string;
  patientId: string;
  fichaTipo: string;
  facilityCnes: string | null;
  professionalCns: string | null;
  cbo: string | null;
  ine: string | null;
  encounterJson: string;
}): ProdUnit {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.encounterJson || '{}') as Record<string, unknown>;
  } catch {
    payload = {};
  }
  const header = headerOf(payload);
  const lotacao = asRecord(header.lotacaoFormPrincipal) || {};
  const kindHint =
    row.fichaTipo === 'FAI'
      ? 'individual_encounter'
      : row.fichaTipo === 'FAO'
        ? 'dental_encounter'
        : row.fichaTipo === 'AD'
          ? 'home_care'
          : row.fichaTipo;
  const conduta = extractConduta(payload, kindHint);
  const cidadao = extractCidadaoIdsFromPayload(payload);
  const unit: ProdUnit = {
    sourceType: 'production_record',
    sourceId: row.id,
    fichaTipo: row.fichaTipo,
    cnes: str(row.facilityCnes || header.cnes || payload.facilityCnes),
    ine: str(row.ine || header.ine || lotacao.ine),
    professionalCns: str(row.professionalCns || header.profissionalCNS || lotacao.profissionalCNS),
    cbo: str(row.cbo || header.cboCodigo_2002 || lotacao.cboCodigo_2002),
    procedureCodes: extractProcedureCodes(payload, kindHint),
    ciaps: extractCiaps(payload),
    hasCondutaField: conduta.hasField,
    condutaOk: conduta.ok,
    patientId: row.patientId,
    cidadaoCns: cidadao.cns,
    cidadaoCpf: cidadao.cpf,
  };
  unit.href = resolveFatAuditHref(unit);
  return unit;
}

@Injectable()
export class FaturamentoAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sigtap: SigtapService,
  ) {}

  async audit(opts: { competencia?: string; ibge?: string; gestao?: CnesSyncGestao } = {}): Promise<FatAuditReport> {
    const ibgeCode = (opts.ibge || FRANCA_IBGE).replace(/\D/g, '');
    if (!/^\d{7}$/.test(ibgeCode)) {
      throw new BadRequestException('ibge deve ter 7 dígitos');
    }
    const gestao = opts.gestao || 'municipal';
    const comp = parseCompetencia(opts.competencia);

    const cadastro = await this.buildCadastroIndex(ibgeCode, gestao);
    const cidadaoMaster = await this.loadCidadaoMasterCtx();
    const units: ProdUnit[] = [];

    const batches = await this.prisma.productionBatch.findMany({
      where: {
        createdAt: { gte: comp.start, lt: comp.end },
        status: { in: ['draft', 'ready', 'sent', 'error'] },
      },
      select: { id: true, kind: true, payloadJson: true },
      take: 2000,
    });
    for (const b of batches) {
      const u = unitFromBatch(b);
      if (u) units.push(u);
    }

    const records = await this.prisma.productionRecord.findMany({
      where: {
        OR: [
          { periodStart: { gte: comp.start, lt: comp.end } },
          {
            periodStart: null,
            createdAt: { gte: comp.start, lt: comp.end },
          },
        ],
      },
      select: {
        id: true,
        patientId: true,
        fichaTipo: true,
        facilityCnes: true,
        professionalCns: true,
        cbo: true,
        ine: true,
        encounterJson: true,
      },
      take: 2000,
    });
    for (const r of records) units.push(unitFromProductionRecord(r));

    const encounters = await this.prisma.encounter.findMany({
      where: {
        finishedAt: { gte: comp.start, lt: comp.end },
        status: { in: ['COMPLETED'] },
      },
      include: {
        facility: true,
        professional: true,
      },
      take: 500,
    });
    const teamIds = [...new Set(encounters.map((e) => e.teamId).filter(Boolean))] as string[];
    const teamsForEnc =
      teamIds.length > 0
        ? await this.prisma.team.findMany({ where: { id: { in: teamIds } } })
        : [];
    const teamById = new Map(teamsForEnc.map((t) => [t.id, t]));
    for (const enc of encounters) {
      let clinical: Record<string, unknown> = {};
      try {
        clinical = JSON.parse(enc.clinicalJson || '{}') as Record<string, unknown>;
      } catch {
        clinical = {};
      }
      const team = enc.teamId ? teamById.get(enc.teamId) : undefined;
      const unit: ProdUnit = {
        sourceType: 'encounter',
        sourceId: enc.id,
        fichaTipo: enc.encounterType || 'NATIVE',
        cnes: enc.facility.cnes,
        ine: team?.ine || '',
        professionalCns: enc.professional?.cns || '',
        cbo: str(clinical.cbo),
        procedureCodes: extractProcedureCodes(clinical, 'individual_encounter'),
        ciaps: extractCiaps(clinical),
        hasCondutaField: true,
        condutaOk: extractConduta(
          {
            atendimentosIndividuais: [
              {
                condutas: clinical.condutas || clinical.outcomes,
                problemaCondicaoAvaliada: clinical.problemaCondicaoAvaliada,
              },
            ],
          },
          'individual_encounter',
        ).ok,
        patientId: enc.patientId,
      };
      unit.href = resolveFatAuditHref(unit);
      units.push(unit);
    }

    const allProcCodes = [...new Set(units.flatMap((u) => u.procedureCodes))];
    const sigtapMap = await this.sigtap.enrichProcedureCodes(allProcCodes);
    const sigtapRows = await this.prisma.sigtapProcedure.findMany({
      where: { code: { in: allProcCodes } },
      select: { code: true, active: true, competencia: true },
    });
    const sigtapComp = new Map(sigtapRows.map((r) => [r.code, r]));

    const findings: FatAuditFinding[] = [];
    for (const u of units) {
      this.auditUnit(u, cadastro, sigtapMap, sigtapComp, comp.ym, findings, cidadaoMaster);
    }

    const bySeverity: Record<FatAuditSeverity, number> = { blocker: 0, quality: 0 };
    const byCode: Partial<Record<FatAuditCode, number>> = {};
    for (const f of findings) {
      bySeverity[f.severity] += 1;
      byCode[f.code] = (byCode[f.code] || 0) + 1;
    }
    const rank = { blocker: 0, quality: 1 };
    findings.sort(
      (a, b) => rank[a.severity] - rank[b.severity] || a.code.localeCompare(b.code),
    );

    await this.prisma.audit(
      'audit',
      'faturamento',
      comp.display,
      [RF.FATURAMENTO_AUDIT.id, RF.PROD.id, RF.SIGTAP_VALIDATE.id, RF.CNES_AUDIT.id],
      {
        ibgeCode,
        gestao,
        findings: findings.length,
        blockers: bySeverity.blocker,
      },
    );

    return {
      competencia: comp.display,
      competenciaYm: comp.ym,
      ibgeCode,
      generatedAt: new Date().toISOString(),
      gestao,
      gestaoCriterion: CNES_GESTAO_CRITERION,
      counts: {
        findings: findings.length,
        bySeverity,
        byCode,
        sources: {
          batches: batches.length,
          productionRecords: records.length,
          encounters: encounters.length,
        },
        cnesMunicipal: cadastro.scope.after.establishments,
        cnesCity: cadastro.scope.before.establishments,
        teamsMunicipal: cadastro.scope.after.teams,
        teamsCity: cadastro.scope.before.teams,
      },
      findings,
      rfIds: [RF.FATURAMENTO_AUDIT.id, RF.PROD.id, RF.SIGTAP_VALIDATE.id, RF.CNES_AUDIT.id],
    };
  }

  private async buildCadastroIndex(
    ibgeCode: string,
    gestao: CnesSyncGestao = 'municipal',
  ): Promise<CadastroIndex & { scope: { before: { establishments: number; teams: number }; after: { establishments: number; teams: number } } }> {
    const facilityByCnes = new Map<
      string,
      { id: string; active: boolean; ibgeCode: string | null; name: string }
    >();
    const teamByIne = new Map<string, { id: string; active: boolean; cnes: string; name: string }>();
    const assignmentsByCns = new Map<
      string,
      Array<{ facilityCnes: string; ine: string | null; cbo: string; facilityId: string; teamId: string | null }>
    >();
    let scope = {
      before: { establishments: 0, teams: 0 },
      after: { establishments: 0, teams: 0 },
    };

    try {
      const { snapshot } = loadBundledSnapshot(ibgeCode);
      const { snapshot: scoped, filter } = applyGestaoFilter(snapshot, gestao);
      scope = {
        before: {
          establishments: filter.before.establishments,
          teams: filter.before.teams,
        },
        after: {
          establishments: filter.after.establishments,
          teams: filter.after.teams,
        },
      };
      for (const e of scoped.establishments) {
        const cnes = normalizeCnes(e.cnes) || e.cnes;
        facilityByCnes.set(cnes, {
          id: `snap:${cnes}`,
          active: e.active,
          ibgeCode: e.ibgeCode,
          name: e.name,
        });
      }
      for (const t of scoped.teams) {
        const ine = normalizeIne(t.ine) || t.ine;
        teamByIne.set(ine, {
          id: `snap:${ine}`,
          active: t.active !== false,
          cnes: normalizeCnes(t.cnes) || t.cnes,
          name: t.name,
        });
      }
    } catch {
      // fallback só SIGS abaixo
    }

    const facilities = await this.prisma.facility.findMany({
      where: { OR: [{ ibgeCode }, { ibgeCode: null }] },
    });
    for (const f of facilities) {
      const cnes = normalizeCnes(f.cnes) || f.cnes;
      // Em gestao=municipal, só sobrescreve/aceita CNES já no índice (rede Prefeitura)
      // ou, se o snapshot falhou, aceita o que está no banco (já filtrado pelo sync default).
      if (gestao === 'municipal' && scope.after.establishments > 0 && !facilityByCnes.has(cnes)) {
        continue;
      }
      const prev = facilityByCnes.get(cnes);
      facilityByCnes.set(cnes, {
        id: f.id,
        active: f.active,
        ibgeCode: f.ibgeCode,
        name: f.name,
      });
      // se snapshot dizia inativo e SIGS ativo, mantém active do SIGS para cruzamento de produção
      if (prev && !prev.active && f.active) {
        facilityByCnes.set(cnes, { ...facilityByCnes.get(cnes)!, active: true });
      }
    }

    const teams = await this.prisma.team.findMany({ include: { facility: true } });
    for (const t of teams) {
      if (!t.ine) continue;
      const ine = normalizeIne(t.ine) || t.ine;
      const facCnes = normalizeCnes(t.facility.cnes) || t.facility.cnes;
      if (gestao === 'municipal' && scope.after.establishments > 0 && !facilityByCnes.has(facCnes) && !teamByIne.has(ine)) {
        continue;
      }
      teamByIne.set(ine, {
        id: t.id,
        active: t.active,
        cnes: facCnes,
        name: t.name,
      });
    }

    const assignments = await this.prisma.professionalAssignment.findMany({
      where: { active: true },
      include: { professional: true, facility: true, team: true },
      take: 8000,
    });
    for (const a of assignments) {
      const cns = (a.professional.cns || '').replace(/\D/g, '');
      if (!cns) continue;
      const facCnes = normalizeCnes(a.facility.cnes) || a.facility.cnes;
      if (gestao === 'municipal' && scope.after.establishments > 0 && !facilityByCnes.has(facCnes)) {
        continue;
      }
      const list = assignmentsByCns.get(cns) || [];
      list.push({
        facilityCnes: facCnes,
        ine: a.team?.ine ? normalizeIne(a.team.ine) || a.team.ine : null,
        cbo: a.cbo,
        facilityId: a.facilityId,
        teamId: a.teamId,
      });
      assignmentsByCns.set(cns, list);
    }

    const municipalCnsFromPf = new Set<string>();
    try {
      const { snapshot: pf } = loadProfessionalsSnapshot(ibgeCode);
      for (const p of pf.professionals) {
        const cns = String(p.cns || '').replace(/\D/g, '');
        if (cns.length === 15) municipalCnsFromPf.add(cns);
      }
    } catch {
      // snapshot PF opcional até a 1ª coleta
    }

    return { facilityByCnes, teamByIne, assignmentsByCns, municipalCnsFromPf, scope };
  }

  private async loadCidadaoMasterCtx(): Promise<LediCidadaoMasterCtx | null> {
    try {
      const knownCns = new Set<string>();
      const knownCpf = new Set<string>();
      const patients = await this.prisma.patient.findMany({
        where: { OR: [{ cns: { not: null } }, { cpf: { not: null } }] },
        select: { cns: true, cpf: true },
        take: 20_000,
      });
      for (const p of patients) {
        const cns = (p.cns || '').replace(/\D/g, '');
        const cpf = (p.cpf || '').replace(/\D/g, '');
        if (cns.length === 15) knownCns.add(cns);
        if (cpf.length === 11) knownCpf.add(cpf);
      }
      const ids = await this.prisma.patientIdentifier.findMany({
        where: { system: { in: ['cns', 'cpf'] } },
        select: { system: true, value: true },
        take: 40_000,
      });
      for (const row of ids) {
        const v = (row.value || '').replace(/\D/g, '');
        if (row.system === 'cns' && v.length === 15) knownCns.add(v);
        if (row.system === 'cpf' && v.length === 11) knownCpf.add(v);
      }
      if (!knownCns.size && !knownCpf.size) return null;
      return { knownCns, knownCpf };
    } catch {
      return null;
    }
  }

  private auditUnit(
    u: ProdUnit,
    cadastro: CadastroIndex,
    sigtapMap: Record<string, { code: string; known: boolean; name: string | null; active: boolean }>,
    sigtapComp: Map<string, { code: string; active: boolean; competencia: string | null }>,
    competenciaYm: string,
    findings: FatAuditFinding[],
    cidadaoMaster?: LediCidadaoMasterCtx | null,
  ) {
    const base = {
      sourceType: u.sourceType,
      sourceId: u.sourceId,
      fichaTipo: u.fichaTipo,
      cnes: u.cnes || null,
      ine: u.ine || null,
      professionalCns: u.professionalCns || null,
      cbo: u.cbo || null,
      href: u.href || resolveFatAuditHref(u),
      patientId: u.patientId || null,
    };

    const cnesNorm = normalizeCnes(u.cnes) || u.cnes;
    if (!u.cnes) {
      findings.push({
        ...base,
        code: 'CNES_MISSING',
        severity: 'blocker',
        message: 'CNES ausente na ficha/lote',
      });
    } else if (!isValidCnesFormat(u.cnes)) {
      findings.push({
        ...base,
        code: 'CNES_FORMAT',
        severity: 'blocker',
        message: `CNES "${u.cnes}" não tem 7 dígitos úteis`,
      });
    } else {
      const fac = cadastro.facilityByCnes.get(cnesNorm);
      if (!fac) {
        findings.push({
          ...base,
          code: 'CNES_NOT_IN_MUNICIPIO',
          severity: 'blocker',
          message: `CNES ${cnesNorm} não encontrado no cadastro/snapshot municipal`,
        });
      } else if (!fac.active) {
        findings.push({
          ...base,
          code: 'CNES_INACTIVE',
          severity: 'blocker',
          message: `CNES ${cnesNorm} inativo no cadastro municipal`,
          details: { facilityName: fac.name },
        });
      } else if (fac.ibgeCode && fac.ibgeCode !== FRANCA_IBGE && fac.ibgeCode.length === 7) {
        // already scoped; soft check
      }
    }

    const ineNorm = normalizeIne(u.ine) || u.ine;
    if (!u.ine) {
      findings.push({
        ...base,
        code: 'INE_MISSING',
        severity: 'blocker',
        message: 'INE da equipe ausente na ficha/lote',
      });
    } else {
      const team = cadastro.teamByIne.get(ineNorm);
      if (!team) {
        findings.push({
          ...base,
          code: 'INE_NOT_FOUND',
          severity: 'blocker',
          message: `INE ${ineNorm} inexistente no cadastro/snapshot CNES`,
        });
      } else if (cnesNorm && team.cnes && team.cnes !== cnesNorm) {
        findings.push({
          ...base,
          code: 'INE_CNES_MISMATCH',
          severity: 'blocker',
          message: `INE ${ineNorm} pertence ao CNES ${team.cnes}, ficha aponta ${cnesNorm}`,
          details: { expectedCnes: team.cnes },
        });
      }
    }

    const cnsDigits = u.professionalCns.replace(/\D/g, '');
    if (!cnsDigits) {
      findings.push({
        ...base,
        code: 'CNS_MISSING',
        severity: 'blocker',
        message: 'CNS do profissional ausente na ficha/lote',
      });
    } else {
      if (cadastro.municipalCnsFromPf.size > 0 && !cadastro.municipalCnsFromPf.has(cnsDigits)) {
        findings.push({
          ...base,
          code: 'CNS_NOT_IN_MUNICIPAL_CNES',
          severity: 'quality',
          message: `CNS ${cnsDigits} não aparece no snapshot PF da rede municipal (CnesWeb)`,
        });
      }
      if (cadastro.assignmentsByCns.size > 0) {
        const lots = cadastro.assignmentsByCns.get(cnsDigits);
        if (!lots || !lots.length) {
          findings.push({
            ...base,
            code: 'CNS_NOT_LINKED',
            severity: 'quality',
            message: `CNS ${cnsDigits} sem lotação ativa no SIGS (rode sync-professionals se ainda não importou PF)`,
          });
        } else {
          const matchCnes = lots.some((l) => !cnesNorm || l.facilityCnes === cnesNorm);
          const matchIne = !ineNorm || lots.some((l) => l.ine === ineNorm);
          if (!matchCnes || !matchIne) {
            findings.push({
              ...base,
              code: 'CNS_NOT_LINKED',
              severity: 'quality',
              message: `CNS ${cnsDigits} sem lotação ativa na unidade/equipe da ficha`,
              details: { lots: lots.map((l) => ({ cnes: l.facilityCnes, ine: l.ine, cbo: l.cbo })) },
            });
          }
          if (u.cbo) {
            const cboOk = lots.some(
              (l) =>
                (!cnesNorm || l.facilityCnes === cnesNorm) &&
                (!ineNorm || !l.ine || l.ine === ineNorm) &&
                l.cbo.replace(/\D/g, '') === u.cbo.replace(/\D/g, ''),
            );
            if (!cboOk) {
              findings.push({
                ...base,
                code: 'CBO_MISMATCH',
                severity: 'quality',
                message: `CBO ${u.cbo} não bate com lotação ativa do CNS ${cnsDigits}`,
                procedureCode: null,
              });
            }
          }
        }
      }
    }

    for (const code of u.procedureCodes) {
      const known = sigtapMap[code];
      const row = sigtapComp.get(code);
      if (!known?.known && !row) {
        findings.push({
          ...base,
          code: 'SIGTAP_UNKNOWN',
          severity: 'blocker',
          message: `Procedimento SIGTAP ${code} ausente do catálogo local`,
          procedureCode: code,
        });
        continue;
      }
      if (row && !row.active) {
        findings.push({
          ...base,
          code: 'SIGTAP_INACTIVE',
          severity: 'blocker',
          message: `Procedimento SIGTAP ${code} inativo no catálogo`,
          procedureCode: code,
        });
      }
      if (row?.competencia && row.competencia.replace(/\D/g, '').slice(0, 6) !== competenciaYm) {
        findings.push({
          ...base,
          code: 'SIGTAP_COMPETENCIA',
          severity: 'quality',
          message: `SIGTAP ${code} no catálogo com competência ${row.competencia} (pedido ${competenciaYm})`,
          procedureCode: code,
          details: { catalogCompetencia: row.competencia },
        });
      }
    }

    for (const ciap of u.ciaps) {
      if (!isValidCiapFormat(ciap)) {
        findings.push({
          ...base,
          code: 'CIAP_FORMAT',
          severity: 'quality',
          message: `CIAP "${ciap}" fora do formato esperado (letra + 2 dígitos)`,
          details: { ciap },
        });
      }
    }

    if (u.hasCondutaField && !u.condutaOk) {
      findings.push({
        ...base,
        code: 'CONDUTA_MISSING',
        severity: 'blocker',
        message: 'Conduta/desfecho ausente na ficha (bloqueia envio LEDI)',
      });
    }

    // P×2 — cidadão × Paciente Mestre (não aplica a encounter nativo já vinculado)
    if (u.sourceType !== 'encounter' && cidadaoMaster) {
      const tmp: FaoFinding[] = [];
      appendCidadaoMasterCrossChecks(
        tmp,
        { cns: u.cidadaoCns || '', cpf: u.cidadaoCpf || '' },
        u.fichaTipo,
        cidadaoMaster,
      );
      for (const f of tmp) {
        findings.push({
          ...base,
          code: f.code as FatAuditCode,
          severity: 'quality',
          message: f.message,
          details: { hint: f.hint, rule: f.rule },
        });
      }
    }
  }
}

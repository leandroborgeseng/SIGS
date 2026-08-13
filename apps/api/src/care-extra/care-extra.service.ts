import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { resolveLotacaoHeader } from '../ledi/lotacao.resolver';
import {
  LEDI_CONDUTA_ODONTO,
  LEDI_LOCAL_ATENDIMENTO,
  LEDI_TIPO_ATENDIMENTO,
  LEDI_TIPO_CONSULTA_ODONTO,
  LEDI_TURNO,
} from '../ledi/db-enums';
import {
  CreateDentalEncounterDto,
  CreateHomeCareVisitDto,
  CreateCollectiveActivityDto,
  FinishDentalEncounterDto,
  FinishHomeCareVisitDto,
  FinishCollectiveActivityDto,
  PatchDentalEncounterDto,
  ValidateDentalFaoDto,
} from './dto';
import { buildDentalLediPayload } from './ledi-dental.mapper';
import { buildHomeCareLediPayload } from './ledi-homecare.mapper';
import { buildCollectiveLediPayload } from './ledi-collective.mapper';
import { validateFaoJson, validateFaoXml } from './ledi-fao.validator';
import {
  defaultDentalCareDraft,
  dentalMunicipioIbgeFallback,
  requireIneOnDentalOpen,
  type DentalCareDraft,
} from './dental-care.draft';
import {
  bucketFromFindings,
  competenciaFromDate,
  competenciaRange,
  dentalMissingChecklist,
} from './dental-billing-queue';
import { FRANCA_LEDI_DEFAULTS } from './ledi-autofix.pipeline';
import type { FaoFinding } from './ledi-fao.validator';

@Injectable()
export class CareExtraService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveLotacao(opts: {
    professionalId?: string | null;
    facilityId: string;
    facilityCnes: string;
    professionalCns?: string | null;
    teamId?: string | null;
    teamIne?: string | null;
    assignmentId?: string | null;
    cbo?: string | null;
  }) {
    const assignments = opts.professionalId
      ? await this.prisma.professionalAssignment.findMany({
          where: {
            professionalId: opts.professionalId,
            facilityId: opts.facilityId,
            active: true,
          },
          include: { professional: true, facility: true, team: true },
        })
      : [];
    try {
      return resolveLotacaoHeader({
        facilityCnes: opts.facilityCnes,
        professionalCns: opts.professionalCns,
        teamIne: opts.teamIne,
        cboOverride: opts.cbo,
        assignmentId: opts.assignmentId,
        assignments,
        professionalId: opts.professionalId,
        facilityId: opts.facilityId,
        teamId: opts.teamId,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  catalogDental() {
    return {
      config: {
        requireIneOnDentalOpen: requireIneOnDentalOpen(),
        defaultTipoAtendimento: defaultDentalCareDraft().tipoAtendimento,
        defaultLocalAtendimento: defaultDentalCareDraft().localAtendimento,
        defaultTurno: defaultDentalCareDraft().turno,
        municipioIbgeFallback: dentalMunicipioIbgeFallback(),
        francaDefaults: FRANCA_LEDI_DEFAULTS,
      },
      tipoAtendimento: LEDI_TIPO_ATENDIMENTO.filter((t) => [2, 4, 5, 6].includes(t.id)).map((t) => ({
        id: t.id,
        code: t.code,
        label: t.label,
      })),
      tiposConsultaOdonto: LEDI_TIPO_CONSULTA_ODONTO.map((t) => ({
        id: t.id,
        code: t.code,
        label: t.label,
      })),
      localAtendimento: LEDI_LOCAL_ATENDIMENTO.filter((t) => t.id >= 1 && t.id <= 10).map((t) => ({
        id: t.id,
        code: t.code,
        label: t.label,
      })),
      turno: LEDI_TURNO.map((t) => ({ id: t.id, code: t.code, label: t.label })),
      vigilanciaSaudeBucal: [
        { id: 1, label: 'Abscesso dentoalveolar' },
        { id: 2, label: 'Alteração em tecidos moles' },
        { id: 3, label: 'Dor de dente' },
        { id: 4, label: 'Traumatismo dentoalveolar' },
        { id: 5, label: 'Não identificado / sem marcador' },
        { id: 6, label: 'Fluorose' },
        { id: 7, label: 'Outro' },
      ],
      condutas: LEDI_CONDUTA_ODONTO.map((c) => ({
        id: c.code,
        label: c.label,
        lediId: c.id,
      })),
      fornecimentos: [
        { id: 'ESCOVA', label: 'Escova dental', lediId: 1 },
        { id: 'CREME', label: 'Creme dental', lediId: 2 },
        { id: 'FIO', label: 'Fio dental', lediId: 3 },
      ],
      justificativaNaoPossuiCpf: [
        { id: 1, label: 'Não possui CPF' },
        { id: 2, label: 'Aguardando emissão' },
        { id: 99, label: 'Outro' },
      ],
      channelNote:
        'Conformidade de envio odonto APS/CEO→Siaps/RNDS: LEDI FAO (XML|Thrift), não Bundle FHIR RIA neste fluxo.',
    };
  }

  validateDentalFao(dto: ValidateDentalFaoDto) {
    if (dto.xml?.trim()) {
      const report = validateFaoXml(dto.xml);
      void this.prisma.audit('validate_fao_xml', 'dental_ledi', 'xml', [RF.ODONTO.id, RF.ESUS.id], {
        conformant: report.conformant,
        blockers: report.summary.blockers,
      });
      return report;
    }
    if (dto.master && typeof dto.master === 'object') {
      const report = validateFaoJson(dto.master);
      void this.prisma.audit('validate_fao_json', 'dental_ledi', 'json', [RF.ODONTO.id, RF.ESUS.id], {
        conformant: report.conformant,
        blockers: report.summary.blockers,
      });
      return report;
    }
    throw new BadRequestException('Envie xml (string) ou master (objeto JSON FAO).');
  }

  listDental(facilityId?: string) {
    return this.prisma.dentalEncounter.findMany({
      where: facilityId ? { facilityId } : undefined,
      orderBy: { startedAt: 'desc' },
      include: { patient: true, facility: true, professional: true },
    });
  }

  private parseCare(raw: string | null | undefined): DentalCareDraft {
    try {
      return defaultDentalCareDraft(JSON.parse(raw || '{}') as Partial<DentalCareDraft>);
    } catch {
      return defaultDentalCareDraft();
    }
  }

  private serializeDental(row: {
    id: string;
    patientId: string;
    facilityId: string;
    professionalId: string | null;
    assignmentId?: string | null;
    encounterType: string;
    status: string;
    anamnese: string | null;
    proceduresJson: string;
    odontogramJson: string;
    outcomesJson: string;
    careJson?: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    productionBatchId: string | null;
    createdAt: Date;
    updatedAt: Date;
    patient?: unknown;
    facility?: unknown;
    professional?: unknown;
  }) {
    const care = this.parseCare(row.careJson);
    return {
      ...row,
      procedures: JSON.parse(row.proceduresJson || '[]'),
      odontogram: JSON.parse(row.odontogramJson || '{}'),
      outcomes: JSON.parse(row.outcomesJson || '[]'),
      care,
    };
  }

  async getDental(id: string) {
    const row = await this.prisma.dentalEncounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atendimento odontológico não encontrado');
    return this.serializeDental(row);
  }

  async openDental(dto: CreateDentalEncounterDto) {
    if (!(await this.prisma.patient.findUnique({ where: { id: dto.patientId } }))) {
      throw new BadRequestException('patientId inválido');
    }
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');

    const lotacao = await this.resolveLotacao({
      professionalId: dto.professionalId,
      facilityId: dto.facilityId,
      facilityCnes: facility.cnes,
      assignmentId: dto.assignmentId,
      cbo: dto.cbo || FRANCA_LEDI_DEFAULTS.cboOdontoPadrao,
    });
    if (requireIneOnDentalOpen() && !lotacao.ine) {
      throw new BadRequestException(
        'INE obrigatório na abertura do atendimento odonto (param REQUIRE_INE_DENTAL_OPEN). Informe assignmentId/equipe com INE.',
      );
    }
    if (!facility.ibgeCode && !dentalMunicipioIbgeFallback()) {
      throw new BadRequestException('Unidade sem IBGE e sem MUNICIPIO_IBGE configurado.');
    }

    const care = defaultDentalCareDraft({
      assignmentId: dto.assignmentId || null,
      cbo: dto.cbo || lotacao.cboCodigo_2002,
    });

    const row = await this.prisma.dentalEncounter.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        assignmentId: dto.assignmentId,
        encounterType: dto.encounterType || 'CONSULTA',
        anamnese: dto.anamnese,
        proceduresJson: JSON.stringify(dto.procedures || []),
        odontogramJson: JSON.stringify(dto.odontogram || {}),
        careJson: JSON.stringify(care),
        status: 'IN_PROGRESS',
      },
      include: { patient: true, facility: true, professional: true },
    });

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'dental_encounter',
        status: 'draft',
        rfIdsCsv: [RF.ODONTO.id, RF.PROD.id, RF.BPA.id, RF.ESUS.id].join(','),
        payloadJson: JSON.stringify({
          encounterId: row.id,
          facilityId: row.facilityId,
          patientId: row.patientId,
          competencia: competenciaFromDate(row.startedAt),
          queue: true,
        }),
        statusChangedAt: new Date(),
        errorMessage: 'Atendimento aberto — pendente validação/preenchimento',
      },
    });
    const withBatch = await this.prisma.dentalEncounter.update({
      where: { id: row.id },
      data: { productionBatchId: batch.id },
      include: { patient: true, facility: true, professional: true },
    });
    await this.syncDentalBillingQueue(withBatch.id).catch(() => undefined);

    await this.prisma.audit('open', 'dental_encounter', row.id, [RF.ODONTO.id], {
      requireIne: requireIneOnDentalOpen(),
      tipoAtendimento: care.tipoAtendimento,
      productionBatchId: batch.id,
    });
    return this.serializeDental(withBatch);
  }

  async patchDental(id: string, dto: PatchDentalEncounterDto) {
    const row = await this.prisma.dentalEncounter.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Atendimento odontológico não encontrado');
    if (row.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Só é possível editar atendimento em andamento');
    }

    const care = this.parseCare(row.careJson);
    const nextCare: DentalCareDraft = {
      ...care,
      ...(dto.tipoAtendimento != null ? { tipoAtendimento: dto.tipoAtendimento } : {}),
      ...(dto.tiposConsultaOdonto ? { tiposConsultaOdonto: dto.tiposConsultaOdonto } : {}),
      ...(dto.localAtendimento != null ? { localAtendimento: dto.localAtendimento } : {}),
      ...(dto.turno != null ? { turno: dto.turno } : {}),
      ...(dto.gestante != null ? { gestante: dto.gestante } : {}),
      ...(dto.necessidadesEspeciais != null
        ? { necessidadesEspeciais: dto.necessidadesEspeciais }
        : {}),
      ...(dto.outcomes ? { outcomes: dto.outcomes } : {}),
      ...(dto.vigilanciaSaudeBucal ? { vigilanciaSaudeBucal: dto.vigilanciaSaudeBucal } : {}),
      ...(dto.fornecimentos ? { fornecimentos: dto.fornecimentos } : {}),
      ...(dto.problemasCondicoes ? { problemasCondicoes: dto.problemasCondicoes } : {}),
      ...(dto.stNaoPossuiCpf != null ? { stNaoPossuiCpf: dto.stNaoPossuiCpf } : {}),
      ...(dto.justificativaNaoPossuiCpf !== undefined
        ? { justificativaNaoPossuiCpf: dto.justificativaNaoPossuiCpf }
        : {}),
      ...(dto.dataHoraInicialAtendimento !== undefined
        ? { dataHoraInicialAtendimento: dto.dataHoraInicialAtendimento }
        : {}),
      ...(dto.dataHoraFinalAtendimento !== undefined
        ? { dataHoraFinalAtendimento: dto.dataHoraFinalAtendimento }
        : {}),
      ...(dto.assignmentId !== undefined ? { assignmentId: dto.assignmentId } : {}),
      ...(dto.cbo !== undefined ? { cbo: dto.cbo } : {}),
    };

    const updated = await this.prisma.dentalEncounter.update({
      where: { id },
      data: {
        anamnese: dto.anamnese !== undefined ? dto.anamnese : undefined,
        professionalId: dto.professionalId !== undefined ? dto.professionalId : undefined,
        assignmentId: dto.assignmentId !== undefined ? dto.assignmentId : undefined,
        proceduresJson:
          dto.procedures !== undefined ? JSON.stringify(dto.procedures) : undefined,
        odontogramJson:
          dto.odontogram !== undefined ? JSON.stringify(dto.odontogram) : undefined,
        careJson: JSON.stringify(nextCare),
        outcomesJson: dto.outcomes ? JSON.stringify(dto.outcomes) : undefined,
      },
      include: { patient: true, facility: true, professional: true },
    });
    await this.syncDentalBillingQueue(id).catch(() => undefined);
    return this.serializeDental(updated);
  }

  /**
   * Atualiza ProductionBatch ligado ao atendimento com snapshot FAO
   * (fila de validação/faturamento do mês).
   */
  async syncDentalBillingQueue(encounterId: string) {
    const row = await this.prisma.dentalEncounter.findUnique({
      where: { id: encounterId },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) return null;

    const care = this.parseCare(row.careJson);
    const procedures = JSON.parse(row.proceduresJson || '[]') as unknown[];
    let hasIne = false;
    try {
      const lot = await this.resolveLotacao({
        professionalId: row.professionalId,
        facilityId: row.facilityId,
        facilityCnes: row.facility.cnes,
        professionalCns: row.professional?.cns,
        assignmentId: row.assignmentId || care.assignmentId || undefined,
        cbo: care.cbo || FRANCA_LEDI_DEFAULTS.cboOdontoPadrao,
      });
      hasIne = !!lot.ine;
    } catch {
      hasIne = false;
    }

    const missing = dentalMissingChecklist({
      care,
      patient: row.patient,
      hasIne,
      requireIne: requireIneOnDentalOpen(),
      proceduresCount: procedures.length,
    });

    let findings: FaoFinding[] = missing.map((m) => ({
      severity: m.severity,
      code: m.code,
      message: m.message,
      rule: 'QUEUE-checklist',
    }));
    let payload: Record<string, unknown> | null = null;
    let faoSummary = { blockers: 0, moneyRisks: 0, qualityWarns: 0 };

    const canTryPayload =
      care.outcomes.length > 0 &&
      care.vigilanciaSaudeBucal.length > 0 &&
      care.problemasCondicoes.some((p) => p.ciap || p.cid10);

    if (canTryPayload) {
      try {
        const built = await this.buildPayloadForEncounter(encounterId, {});
        payload = built.payload as unknown as Record<string, unknown>;
        const fao = validateFaoJson(payload);
        findings = [...findings, ...fao.findings];
        faoSummary = fao.summary;
      } catch (e) {
        findings.push({
          severity: 'BLOCKER',
          code: 'PAYLOAD_BUILD_FAILED',
          message: e instanceof Error ? e.message : String(e),
          rule: 'QUEUE-build',
        });
      }
    }

    // Dedup by code
    const seen = new Set<string>();
    findings = findings.filter((f) => {
      if (seen.has(f.code)) return false;
      seen.add(f.code);
      return true;
    });
    const blockers = findings.filter((f) => f.severity === 'BLOCKER').length;
    const moneyRisks =
      faoSummary.moneyRisks || findings.filter((f) => f.severity === 'MONEY_RISK').length;
    const qualityWarns =
      faoSummary.qualityWarns || findings.filter((f) => f.severity === 'QUALITY_WARN').length;
    const open = row.status === 'IN_PROGRESS';
    const bucket = bucketFromFindings(findings, open);
    const batchStatus =
      row.status === 'COMPLETED' && blockers === 0
        ? 'ready'
        : blockers > 0
          ? 'error'
          : 'draft';

    const snapshot = {
      encounterId: row.id,
      facilityId: row.facilityId,
      patientId: row.patientId,
      competencia: competenciaFromDate(row.startedAt),
      queue: true,
      bucket,
      missing,
      faoValidation: {
        summary: { blockers, moneyRisks, qualityWarns },
        findings,
      },
      ...(payload || {}),
    };

    const errorMessage =
      blockers > 0
        ? findings
            .filter((f) => f.severity === 'BLOCKER')
            .map((f) => f.code)
            .slice(0, 10)
            .join(', ')
        : open
          ? 'Em atendimento — aguardando fechamento'
          : null;

    if (row.productionBatchId) {
      await this.prisma.productionBatch.update({
        where: { id: row.productionBatchId },
        data: {
          status: batchStatus,
          payloadJson: JSON.stringify(snapshot),
          errorMessage,
          statusChangedAt: new Date(),
        },
      });
      return { productionBatchId: row.productionBatchId, bucket, blockers };
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'dental_encounter',
        status: batchStatus,
        rfIdsCsv: [RF.ODONTO.id, RF.PROD.id, RF.BPA.id, RF.ESUS.id].join(','),
        payloadJson: JSON.stringify(snapshot),
        errorMessage,
        statusChangedAt: new Date(),
      },
    });
    await this.prisma.dentalEncounter.update({
      where: { id: row.id },
      data: { productionBatchId: batch.id },
    });
    return { productionBatchId: batch.id, bucket, blockers };
  }

  async syncDentalFaturamentoQueueBatch(opts: {
    competencia?: string;
    facilityId?: string;
    encounterIds?: string[];
  }) {
    const competencia = opts.competencia || competenciaFromDate(new Date());
    const { start, end } = competenciaRange(competencia);
    const rows = await this.prisma.dentalEncounter.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
        ...(opts.encounterIds?.length
          ? { id: { in: opts.encounterIds } }
          : {
              startedAt: { gte: start, lt: end },
              ...(opts.facilityId ? { facilityId: opts.facilityId } : {}),
            }),
      },
      select: { id: true },
      take: 500,
    });
    let synced = 0;
    let failed = 0;
    const results: Array<{ encounterId: string; ok: boolean; bucket?: string }> = [];
    for (const row of rows) {
      try {
        const out = await this.syncDentalBillingQueue(row.id);
        synced += 1;
        results.push({
          encounterId: row.id,
          ok: true,
          bucket: out?.bucket,
        });
      } catch {
        failed += 1;
        results.push({ encounterId: row.id, ok: false });
      }
    }
    return { competencia, synced, failed, total: rows.length, results };
  }

  async listDentalFaturamentoQueue(opts: {
    competencia?: string;
    facilityId?: string;
    bucket?: string;
    forceSync?: boolean;
  }) {
    const competencia = opts.competencia || competenciaFromDate(new Date());
    const { start, end } = competenciaRange(competencia);
    const rows = await this.prisma.dentalEncounter.findMany({
      where: {
        startedAt: { gte: start, lt: end },
        ...(opts.facilityId ? { facilityId: opts.facilityId } : {}),
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      },
      orderBy: { startedAt: 'desc' },
      include: { patient: true, facility: true, professional: true },
    });

    const items = [];
    for (const row of rows) {
      // Re-sync open / missing batch; forceSync revalida todos (refresh útil da fila)
      if (opts.forceSync || row.status === 'IN_PROGRESS' || !row.productionBatchId) {
        await this.syncDentalBillingQueue(row.id).catch(() => undefined);
      }
      const fresh = await this.prisma.dentalEncounter.findUnique({
        where: { id: row.id },
        include: { patient: true, facility: true, professional: true },
      });
      if (!fresh) continue;
      const batch = fresh.productionBatchId
        ? await this.prisma.productionBatch.findUnique({ where: { id: fresh.productionBatchId } })
        : null;
      const payload = JSON.parse(batch?.payloadJson || '{}') as {
        bucket?: string;
        faoValidation?: {
          summary?: { blockers?: number; moneyRisks?: number; qualityWarns?: number };
          findings?: FaoFinding[];
        };
        missing?: Array<{ code: string; severity: string; message: string }>;
      };
      const findings = payload.faoValidation?.findings || [];
      const summary = payload.faoValidation?.summary || {
        blockers: findings.filter((f) => f.severity === 'BLOCKER').length,
        moneyRisks: findings.filter((f) => f.severity === 'MONEY_RISK').length,
        qualityWarns: findings.filter((f) => f.severity === 'QUALITY_WARN').length,
      };
      const bucket =
        payload.bucket ||
        bucketFromFindings(findings, fresh.status === 'IN_PROGRESS');
      if (opts.bucket && opts.bucket !== 'all' && bucket !== opts.bucket) continue;

      const topCodes = [...new Set(findings.map((f) => f.code))].slice(0, 8);
      items.push({
        encounterId: fresh.id,
        productionBatchId: fresh.productionBatchId,
        patient: {
          id: fresh.patient.id,
          name: fresh.patient.socialName || fresh.patient.civilName,
          cpf: fresh.patient.cpf,
          cns: fresh.patient.cns,
        },
        facility: {
          id: fresh.facility.id,
          name: fresh.facility.name,
          cnes: fresh.facility.cnes,
        },
        professionalName: fresh.professional?.civilName || null,
        startedAt: fresh.startedAt,
        finishedAt: fresh.finishedAt,
        encounterStatus: fresh.status,
        batchStatus: batch?.status || 'draft',
        bucket,
        summary,
        topCodes,
        findings,
        missing: payload.missing || [],
        href: `/odonto/${fresh.id}`,
      });
    }

    const totals = {
      total: items.length,
      blocker: items.filter((i) => i.bucket === 'blocker').length,
      money: items.filter((i) => i.bucket === 'money').length,
      quality: items.filter((i) => i.bucket === 'quality').length,
      incomplete: items.filter((i) => i.bucket === 'incomplete').length,
      ok: items.filter((i) => i.bucket === 'ok').length,
      ready: items.filter((i) => i.batchStatus === 'ready').length,
      sent: items.filter((i) => i.batchStatus === 'sent').length,
      open: items.filter((i) => i.encounterStatus === 'IN_PROGRESS').length,
    };

    return { competencia, facilityId: opts.facilityId || null, totals, items };
  }

  /** Monta payload + valida sem gravar finish (painel ao vivo). */
  async previewDentalFao(id: string) {
    const built = await this.buildPayloadForEncounter(id, {});
    const fao = validateFaoJson(built.payload as unknown as Record<string, unknown>);
    return {
      encounterId: id,
      lotacao: built.lotacao,
      fao,
      siapsReady: fao.summary.blockers === 0,
      payload: built.payload,
    };
  }

  private async buildPayloadForEncounter(id: string, dto: FinishDentalEncounterDto) {
    const row = await this.prisma.dentalEncounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atendimento odontológico não encontrado');
    const care = this.parseCare(row.careJson);

    const outcomes = dto.outcomes?.length ? dto.outcomes : care.outcomes;
    if (!outcomes?.length) throw new BadRequestException('outcomes (condutas) obrigatórias');

    const assignmentId = dto.assignmentId || care.assignmentId || row.assignmentId;
    const cbo = dto.cbo || care.cbo || undefined;
    const lotacao = await this.resolveLotacao({
      professionalId: row.professionalId,
      facilityId: row.facilityId,
      facilityCnes: row.facility.cnes,
      professionalCns: row.professional?.cns,
      assignmentId: assignmentId || undefined,
      cbo: cbo || FRANCA_LEDI_DEFAULTS.cboOdontoPadrao,
    });
    if (requireIneOnDentalOpen() && !lotacao.ine) {
      throw new BadRequestException('INE obrigatório para faturar (param REQUIRE_INE_DENTAL_OPEN).');
    }

    const tipoAtendimento = dto.tipoAtendimento ?? care.tipoAtendimento ?? 5;
    const vigilancia = dto.vigilanciaSaudeBucal?.length
      ? dto.vigilanciaSaudeBucal
      : care.vigilanciaSaudeBucal;
    const problemas = dto.problemasCondicoes?.length
      ? dto.problemasCondicoes
      : care.problemasCondicoes;
    const fornecimentos = dto.fornecimentos?.length ? dto.fornecimentos : care.fornecimentos;
    const tiposConsultaOdonto = dto.tiposConsultaOdonto?.length
      ? dto.tiposConsultaOdonto
      : care.tiposConsultaOdonto;
    const localAtendimento = dto.localAtendimento ?? care.localAtendimento;
    const turno = dto.turno ?? care.turno;
    const gestante = dto.gestante ?? care.gestante;
    const necessidadesEspeciais = dto.necessidadesEspeciais ?? care.necessidadesEspeciais;
    const stNaoPossuiCpf = dto.stNaoPossuiCpf ?? care.stNaoPossuiCpf;
    const justificativaNaoPossuiCpf =
      dto.justificativaNaoPossuiCpf !== undefined
        ? dto.justificativaNaoPossuiCpf
        : care.justificativaNaoPossuiCpf;

    const startedAt = care.dataHoraInicialAtendimento
      ? new Date(care.dataHoraInicialAtendimento)
      : row.startedAt;
    const finishedAt = dto.finishedAt
      ? new Date(dto.finishedAt)
      : care.dataHoraFinalAtendimento
        ? new Date(care.dataHoraFinalAtendimento)
        : new Date();

    const uuidFicha = randomUUID();
    let payload;
    try {
      payload = buildDentalLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: row.facility.ibgeCode || dentalMunicipioIbgeFallback(),
        startedAt,
        finishedAt,
        patient: row.patient,
        encounterType: row.encounterType,
        tipoAtendimento,
        tiposConsultaOdonto,
        outcomes,
        vigilanciaSaudeBucal: vigilancia,
        fornecimentos,
        problemasCondicoes: problemas,
        gestante,
        necessidadesEspeciais,
        stNaoPossuiCpf,
        justificativaNaoPossuiCpf,
        localAtendimento,
        turno,
        procedures: JSON.parse(row.proceduresJson || '[]'),
        odontogram: JSON.parse(row.odontogramJson || '{}'),
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    return { row, care, lotacao, payload, outcomes, finishedAt };
  }

  /**
   * Anula rascunho clínico (IN_PROGRESS → VOID).
   * Não implementa estorno/cancelamento LEDI de ficha já COMPLETED (gap documentado).
   */
  async voidDental(id: string, dto: { reason?: string } = {}) {
    const row = await this.prisma.dentalEncounter.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Atendimento odontológico não encontrado');
    if (row.status === 'VOID') {
      return this.getDental(id);
    }
    if (row.status === 'COMPLETED') {
      throw new BadRequestException(
        'Anulação de atendimento já finalizado (VOID pós-produção LEDI/Siaps) não está implementada. Use fluxo de estorno quando existir.',
      );
    }
    if (row.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`Status ${row.status} não permite anulação`);
    }

    const updated = await this.prisma.dentalEncounter.update({
      where: { id },
      data: { status: 'VOID', finishedAt: new Date() },
      include: { patient: true, facility: true, professional: true },
    });

    if (row.productionBatchId) {
      await this.prisma.productionBatch.update({
        where: { id: row.productionBatchId },
        data: {
          status: 'error',
          errorMessage: 'Atendimento anulado (VOID) antes do fechamento',
          statusChangedAt: new Date(),
        },
      });
    }

    await this.prisma.audit('void', 'dental_encounter', id, [RF.ODONTO.id], {
      reason: dto.reason || null,
      productionBatchId: row.productionBatchId,
    });
    return this.serializeDental(updated);
  }

  async finishDental(id: string, dto: FinishDentalEncounterDto) {
    const rowCheck = await this.prisma.dentalEncounter.findUnique({ where: { id } });
    if (!rowCheck) throw new NotFoundException('Atendimento odontológico não encontrado');
    if (rowCheck.status === 'COMPLETED') throw new BadRequestException('Já finalizado');
    if (rowCheck.status === 'VOID') throw new BadRequestException('Atendimento anulado');

    const built = await this.buildPayloadForEncounter(id, dto);
    const faoReport = validateFaoJson(built.payload as unknown as Record<string, unknown>);
    if (dto.enforceFaoConformity !== false && faoReport.summary.blockers > 0) {
      throw new BadRequestException({
        message: 'Ficha odontológica não conforme para envio Siaps/RNDS (LEDI FAO).',
        fao: faoReport,
      });
    }

    const batchPayload = JSON.stringify({
      ...built.payload,
      encounterId: id,
      competencia: competenciaFromDate(built.row.startedAt),
      queue: true,
      bucket: faoReport.summary.blockers > 0 ? 'blocker' : 'ok',
      faoValidation: faoReport,
    });
    const batchStatus = faoReport.summary.blockers > 0 ? 'error' : 'ready';
    const errorMessage =
      faoReport.summary.blockers > 0
        ? faoReport.findings
            .filter((f) => f.severity === 'BLOCKER')
            .map((f) => f.code)
            .slice(0, 8)
            .join(', ')
        : null;

    let batch;
    if (built.row.productionBatchId) {
      batch = await this.prisma.productionBatch.update({
        where: { id: built.row.productionBatchId },
        data: {
          status: batchStatus,
          errorMessage,
          statusChangedAt: new Date(),
          payloadJson: batchPayload,
        },
      });
    } else {
      batch = await this.prisma.productionBatch.create({
        data: {
          kind: 'dental_encounter',
          status: batchStatus,
          errorMessage,
          statusChangedAt: new Date(),
          rfIdsCsv: [RF.ODONTO.id, RF.PROD.id, RF.BPA.id, RF.ESUS.id].join(','),
          payloadJson: batchPayload,
        },
      });
    }

    const updated = await this.prisma.dentalEncounter.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        finishedAt: built.finishedAt,
        outcomesJson: JSON.stringify(built.outcomes),
        careJson: JSON.stringify(built.care),
        productionBatchId: batch.id,
      },
      include: { patient: true, facility: true, professional: true },
    });
    await this.prisma.audit('finish', 'dental_encounter', id, [RF.ODONTO.id, RF.PROD.id], {
      productionBatchId: batch.id,
      faoConformant: faoReport.conformant,
    });
    return {
      encounter: this.serializeDental(updated),
      productionBatch: { ...batch, payload: built.payload },
      fao: faoReport,
    };
  }

  listHomeCare(facilityId?: string) {
    return this.prisma.homeCareVisit.findMany({
      where: facilityId ? { facilityId } : undefined,
      orderBy: { visitedAt: 'desc' },
      include: { patient: true, facility: true, professional: true },
    });
  }

  async getHomeCare(id: string) {
    const row = await this.prisma.homeCareVisit.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Visita domiciliar não encontrada');
    return {
      ...row,
      procedures: JSON.parse(row.proceduresJson || '[]'),
    };
  }

  catalogHomeCare() {
    return {
      careTypes: [
        { id: 'AD1', label: 'AD1 — atenção domiciliar básica', lediId: 1 },
        { id: 'AD2', label: 'AD2 — atenção domiciliar intermediária', lediId: 2 },
        { id: 'AD3', label: 'AD3 — atenção domiciliar intensiva', lediId: 3 },
      ],
      shifts: [
        { id: 'MANHA', label: 'Manhã', lediId: 1 },
        { id: 'TARDE', label: 'Tarde', lediId: 2 },
        { id: 'NOITE', label: 'Noite', lediId: 3 },
      ],
      desfechos: [
        { id: 'PERMANENCIA', label: 'Permanência', lediId: 7 },
        { id: 'ALTA', label: 'Alta clínica', lediId: 1 },
        { id: 'ALTA_ADMINISTRATIVA', label: 'Alta administrativa', lediId: 3 },
        { id: 'URGENCIA', label: 'Urgência/emergência', lediId: 4 },
      ],
      defaultProcedure: '0101040024',
      procedureHints: [
        { id: '0101040024', label: 'Atendimento / visita domiciliar' },
        { id: 'VISITA', label: 'Visita (genérico stub)' },
        { id: 'ORIENTACAO', label: 'Orientação / educação' },
        { id: 'CURATIVO', label: 'Curativo' },
      ],
    };
  }

  async openHomeCare(dto: CreateHomeCareVisitDto) {
    if (!(await this.prisma.patient.findUnique({ where: { id: dto.patientId } }))) {
      throw new BadRequestException('patientId inválido');
    }
    if (!(await this.prisma.facility.findUnique({ where: { id: dto.facilityId } }))) {
      throw new BadRequestException('facilityId inválido');
    }
    const careType = (dto.careType || 'AD1').toUpperCase();
    if (!['AD1', 'AD2', 'AD3'].includes(careType)) {
      throw new BadRequestException('careType deve ser AD1, AD2 ou AD3');
    }
    const shift = (dto.shift || 'MANHA').toUpperCase();
    if (!['MANHA', 'TARDE', 'NOITE'].includes(shift)) {
      throw new BadRequestException('shift inválido');
    }
    if (dto.professionalId) {
      const p = await this.prisma.professional.findUnique({ where: { id: dto.professionalId } });
      if (!p) throw new BadRequestException('professionalId inválido');
    }

    const procedures =
      dto.procedures?.length ? dto.procedures : ['0101040024', 'VISITA'];

    const row = await this.prisma.homeCareVisit.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        careType,
        shift,
        notes: dto.notes,
        proceduresJson: JSON.stringify(procedures),
        visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : new Date(),
        status: 'IN_PROGRESS',
      },
      include: { patient: true, facility: true, professional: true },
    });
    await this.prisma.audit('open', 'home_care_visit', row.id, [RF.HOME_CARE.id], { careType });
    return row;
  }

  async finishHomeCare(id: string, dto: FinishHomeCareVisitDto) {
    const row = await this.prisma.homeCareVisit.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Visita domiciliar não encontrada');
    if (row.status === 'COMPLETED') throw new BadRequestException('Já finalizada');

    const procedures = dto.procedures || JSON.parse(row.proceduresJson || '[]');
    const lotacao = await this.resolveLotacao({
      professionalId: row.professionalId,
      facilityId: row.facilityId,
      facilityCnes: row.facility.cnes,
      professionalCns: row.professional?.cns,
      assignmentId: dto.assignmentId,
      cbo: dto.cbo,
    });

    const uuidFicha = randomUUID();
    let payload;
    try {
      payload = buildHomeCareLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: row.facility.ibgeCode,
        visitedAt: row.visitedAt,
        patient: row.patient,
        careType: row.careType,
        shift: row.shift,
        procedures,
        desfecho: dto.desfecho || 'PERMANENCIA',
        notes: dto.notes || row.notes,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'home_care',
        status: 'ready',
        rfIdsCsv: [RF.HOME_CARE.id, RF.PROD.id, RF.BPA.id, RF.ESUS.id].join(','),
        payloadJson: JSON.stringify(payload),
      },
    });

    const updated = await this.prisma.homeCareVisit.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : new Date(),
        notes: dto.notes ?? row.notes,
        proceduresJson: JSON.stringify(procedures),
        productionBatchId: batch.id,
      },
      include: { patient: true, facility: true },
    });
    await this.prisma.audit('finish', 'home_care_visit', id, [RF.HOME_CARE.id, RF.PROD.id], {
      productionBatchId: batch.id,
    });
    return { visit: updated, productionBatch: { ...batch, payload } };
  }

  catalogCollective() {
    return {
      activityTypes: [
        { id: 'EDUCACAO_SAUDE', label: 'Educação em saúde', lediId: 4 },
        { id: 'REUNIAO', label: 'Reunião de equipe', lediId: 1 },
        { id: 'OUTRO', label: 'Mobilização social / outro', lediId: 7 },
      ],
      audiences: [
        { id: 'COMUNIDADE', label: 'Comunidade em geral', lediId: 1 },
        { id: 'GESTANTES', label: 'Gestantes', lediId: 7 },
        { id: 'CRIANCAS', label: 'Crianças (6–11)', lediId: 4 },
        { id: 'IDOSOS', label: 'Idosos', lediId: 10 },
        { id: 'HIPERTENSOS', label: 'Hipertensos / crônicos', lediId: 12 },
        { id: 'PROFISSIONAIS', label: 'Profissionais de educação', lediId: 17 },
      ],
      themes: [
        { id: 'ALIMENTACAO', label: 'Alimentação saudável', lediId: 1 },
        { id: 'TABAGISMO', label: 'Tabagismo / PNCT', lediId: 7 },
        { id: 'SAUDE_BUCAL', label: 'Saúde bucal', lediId: 15 },
        { id: 'SAUDE_MENTAL', label: 'Saúde mental', lediId: 16 },
        { id: 'PREVENCAO', label: 'Autocuidado / prevenção', lediId: 4 },
        { id: 'PLANEJAMENTO', label: 'Planejamento da equipe (reunião)', lediId: 4 },
      ],
    };
  }

  listCollective(facilityId?: string) {
    return this.prisma.collectiveActivity.findMany({
      where: facilityId ? { facilityId } : undefined,
      orderBy: { heldAt: 'desc' },
      include: { facility: true, professional: true },
    });
  }

  async getCollective(id: string) {
    const row = await this.prisma.collectiveActivity.findUnique({
      where: { id },
      include: { facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atividade coletiva não encontrada');
    return {
      ...row,
      participants: JSON.parse(row.participantsJson || '[]'),
      procedures: JSON.parse(row.proceduresJson || '[]'),
    };
  }

  async openCollective(dto: CreateCollectiveActivityDto) {
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    if (!dto.activityType?.trim()) throw new BadRequestException('activityType obrigatório');
    if (!dto.theme?.trim()) throw new BadRequestException('theme obrigatório');
    if (!dto.audience?.trim()) throw new BadRequestException('audience obrigatório');

    const participantIds = dto.participantIds || [];
    const participantCount = dto.participantCount ?? participantIds.length;

    const row = await this.prisma.collectiveActivity.create({
      data: {
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        teamId: dto.teamId,
        activityType: dto.activityType,
        theme: dto.theme,
        audience: dto.audience,
        shift: dto.shift || 'MANHA',
        participantCount,
        participantsJson: JSON.stringify(participantIds),
        proceduresJson: JSON.stringify(dto.procedures || []),
        notes: dto.notes,
        heldAt: dto.heldAt ? new Date(dto.heldAt) : new Date(),
        status: 'IN_PROGRESS',
      },
      include: { facility: true, professional: true },
    });
    await this.prisma.audit('open', 'collective_activity', row.id, [RF.COLLECTIVE.id]);
    return row;
  }

  async finishCollective(id: string, dto: FinishCollectiveActivityDto) {
    const row = await this.prisma.collectiveActivity.findUnique({
      where: { id },
      include: { facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atividade coletiva não encontrada');
    if (row.status === 'COMPLETED') throw new BadRequestException('Já finalizada');

    const participantCount = dto.participantCount ?? row.participantCount;
    if (!participantCount || participantCount < 1) {
      throw new BadRequestException('participantCount >= 1 obrigatório para finalizar');
    }
    const procedures = dto.procedures || JSON.parse(row.proceduresJson || '[]');

    let teamIne: string | null = null;
    if (row.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: row.teamId } });
      teamIne = team?.ine ?? null;
    }

    const lotacao = await this.resolveLotacao({
      professionalId: row.professionalId,
      facilityId: row.facilityId,
      facilityCnes: row.facility.cnes,
      professionalCns: row.professional?.cns,
      teamId: row.teamId,
      teamIne,
      assignmentId: dto.assignmentId,
      cbo: dto.cbo,
    });

    const uuidFicha = randomUUID();
    let payload;
    try {
      payload = buildCollectiveLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: row.facility.ibgeCode,
        heldAt: row.heldAt,
        activityType: row.activityType,
        theme: row.theme,
        audience: row.audience,
        shift: row.shift,
        participantCount,
        procedures,
        notes: dto.notes || row.notes,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'collective_activity',
        status: 'ready',
        rfIdsCsv: [RF.COLLECTIVE.id, RF.PROD.id, RF.BPA.id, RF.ESUS.id].join(','),
        payloadJson: JSON.stringify(payload),
      },
    });

    const updated = await this.prisma.collectiveActivity.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : new Date(),
        participantCount,
        proceduresJson: JSON.stringify(procedures),
        notes: dto.notes ?? row.notes,
        productionBatchId: batch.id,
      },
      include: { facility: true, professional: true },
    });
    await this.prisma.audit('finish', 'collective_activity', id, [RF.COLLECTIVE.id, RF.PROD.id], {
      productionBatchId: batch.id,
      participantCount,
    });
    return { activity: updated, productionBatch: { ...batch, payload } };
  }
}

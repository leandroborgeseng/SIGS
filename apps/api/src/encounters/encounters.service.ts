import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ENCOUNTER_ACTIVE_QUEUE,
  ENCOUNTER_STATUS,
  EncounterStatus,
  RF,
} from '../common/rf';
import { FinishEncounterDto, OpenEncounterDto, SaveClinicalDto, UpdateEncounterStatusDto } from './dto';
import { buildIndividualEncounterLediPayload, ClinicalData } from './ledi-individual.mapper';
import { resolveLotacaoHeader } from '../ledi/lotacao.resolver';
import {
  LEDI_CONDUTA,
  LEDI_LOCAL_ATENDIMENTO,
  LEDI_TIPO_ATENDIMENTO,
  LEDI_TURNO,
} from '../ledi/db-enums';
import { validateFaiJson } from '../care-extra/ledi-fai.validator';
import { competenciaFromDate } from '../care-extra/dental-billing-queue';
import { sigtapSeedByTag, SIGTAP_SEED } from '../sigtap/seed';
import {
  apsMunicipioIbgeFallback,
  defaultApsCareDraft,
  isFaiOrigin,
  parseApsCare,
  requireIneOnApsOpen,
  type ApsCareDraft,
} from './aps-care.draft';

@Injectable()
export class EncountersService {
  constructor(private readonly prisma: PrismaService) {}

  private parseClinical(json: string): ClinicalData {
    try {
      return JSON.parse(json || '{}') as ClinicalData;
    } catch {
      return {};
    }
  }

  private startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  catalogAps() {
    const apsProcs = [
      ...SIGTAP_SEED.filter((s) => s.tags?.includes('individual') && s.code === '0301010064'),
      ...sigtapSeedByTag('aps'),
    ];
    const seen = new Set<string>();
    const procedimentos = apsProcs.filter((p) => {
      if (seen.has(p.code)) return false;
      seen.add(p.code);
      return true;
    });
    return {
      config: {
        requireIneOnApsOpen: requireIneOnApsOpen(),
        defaultTipoAtendimento: defaultApsCareDraft().tipoAtendimento,
        defaultLocalAtendimento: defaultApsCareDraft().localAtendimento,
        defaultTurno: defaultApsCareDraft().turno,
        municipioIbgeFallback: apsMunicipioIbgeFallback(),
        fichaTipo: 4,
        channel: 'LEDI_FAI_SIAPS',
      },
      tipoAtendimento: LEDI_TIPO_ATENDIMENTO.filter((t) => [1, 2, 4, 5, 6].includes(t.id)).map(
        (t) => ({ id: t.id, code: t.code, label: t.label }),
      ),
      localAtendimento: LEDI_LOCAL_ATENDIMENTO.filter((t) => t.id >= 1 && t.id <= 10).map((t) => ({
        id: t.id,
        code: t.code,
        label: t.label,
      })),
      turno: LEDI_TURNO.map((t) => ({ id: t.id, code: t.code, label: t.label })),
      condutas: LEDI_CONDUTA.map((c) => ({
        id: c.code,
        label: c.label,
        lediId: c.id,
      })),
      justificativaNaoPossuiCpf: [
        { id: 1, label: 'Não possui CPF' },
        { id: 2, label: 'Aguardando emissão' },
        { id: 99, label: 'Outro' },
      ],
      procedimentos: procedimentos.map((p) => ({
        code: p.code,
        label: p.name,
        group: p.groupName,
      })),
      channelNote:
        'Ficha APS origem = LEDI FAI (tipoDadoSerializado 4). Condutas = TipoEncaminhamentoIndividual, não odonto. Lote legado: /faturamento/lote/fai.',
    };
  }

  async list(facilityId?: string, origin?: string) {
    const rows = await this.prisma.encounter.findMany({
      where: facilityId ? { facilityId } : undefined,
      orderBy: { startedAt: 'desc' },
      include: { patient: true, facility: true, professional: true },
    });
    const mapped = rows.map((row) => this.serialize(row));
    if (origin === 'fai') return mapped.filter((r) => r.care.faiOrigin);
    return mapped;
  }

  async queue(facilityId?: string, status?: string) {
    return this.prisma.encounter.findMany({
      where: {
        ...(facilityId ? { facilityId } : {}),
        ...(status
          ? { status }
          : { status: { in: [...ENCOUNTER_ACTIVE_QUEUE] } }),
      },
      orderBy: { startedAt: 'asc' },
      include: {
        patient: true,
        professional: true,
        facility: true,
      },
    });
  }

  private serialize(row: {
    id: string;
    patientId: string;
    facilityId: string;
    professionalId: string | null;
    teamId?: string | null;
    appointmentId?: string | null;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    careLocation: string | null;
    shift: string | null;
    encounterType: string | null;
    lateRegistration?: boolean;
    clinicalJson: string;
    productionBatchId: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    patient?: unknown;
    facility?: unknown;
    professional?: unknown;
    appointment?: unknown;
  }) {
    const clinical = this.parseClinical(row.clinicalJson);
    const care = parseApsCare(row.clinicalJson);
    return { ...row, clinical, care };
  }

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
      : opts.assignmentId
        ? await this.prisma.professionalAssignment.findMany({
            where: { id: opts.assignmentId, active: true },
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

  async open(dto: OpenEncounterDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new BadRequestException('patientId inválido');
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    if (dto.professionalId) {
      const p = await this.prisma.professional.findUnique({ where: { id: dto.professionalId } });
      if (!p) throw new BadRequestException('professionalId inválido');
    }
    if (dto.appointmentId) {
      const slot = await this.prisma.appointmentSlot.findUnique({ where: { id: dto.appointmentId } });
      if (!slot) throw new BadRequestException('appointmentId inválido');
      const linked = await this.prisma.encounter.findUnique({ where: { appointmentId: dto.appointmentId } });
      if (linked) throw new ConflictException('Agendamento já vinculado a um atendimento');
    }

    if (dto.faiOrigin) {
      return this.openFai(dto, facility);
    }

    const existing = await this.prisma.encounter.findFirst({
      where: {
        patientId: dto.patientId,
        startedAt: { gte: this.startOfToday() },
        status: { in: [...ENCOUNTER_ACTIVE_QUEUE] },
      },
      include: { patient: true, facility: true, professional: true },
    });
    if (existing) {
      await this.prisma.audit('reuse_queue', 'encounter', existing.id, [RF.ENCOUNTER_ENTRY.id], {
        patientId: dto.patientId,
      });
      return { ...existing, reused: true as const };
    }

    const row = await this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        teamId: dto.teamId,
        appointmentId: dto.appointmentId,
        careLocation: dto.careLocation,
        shift: dto.shift,
        encounterType: dto.encounterType,
        lateRegistration: dto.lateRegistration ?? false,
        status: 'WAITING',
      },
      include: { patient: true, facility: true, professional: true },
    });

    if (dto.appointmentId) {
      await this.prisma.appointmentSlot.update({
        where: { id: dto.appointmentId },
        data: { status: 'PRESENT' },
      });
    }

    await this.prisma.audit('open', 'encounter', row.id, [RF.ENCOUNTER_ENTRY.id], {
      patientId: dto.patientId,
    });
    return { ...row, reused: false as const };
  }

  private async openFai(
    dto: OpenEncounterDto,
    facility: { id: string; cnes: string; ibgeCode: string | null },
  ) {
    let professionalId = dto.professionalId;
    let teamId = dto.teamId ?? null;
    let assignmentId = dto.assignmentId ?? null;

    if (assignmentId) {
      const assignment = await this.prisma.professionalAssignment.findUnique({
        where: { id: assignmentId },
        include: { professional: true, facility: true, team: true },
      });
      if (!assignment || !assignment.active) {
        throw new BadRequestException('assignmentId inválido ou inativo');
      }
      if (assignment.facilityId !== dto.facilityId) {
        throw new BadRequestException('Lotação não pertence à unidade selecionada');
      }
      professionalId = professionalId || assignment.professionalId;
      teamId = teamId || assignment.teamId;
    }

    if (professionalId) {
      const p = await this.prisma.professional.findUnique({ where: { id: professionalId } });
      if (!p) throw new BadRequestException('professionalId inválido');
    }

    const lotacao = await this.resolveLotacao({
      professionalId,
      facilityId: dto.facilityId,
      facilityCnes: facility.cnes,
      assignmentId,
      cbo: dto.cbo,
      teamId,
    });
    if (requireIneOnApsOpen() && !lotacao.ine) {
      throw new BadRequestException(
        'INE obrigatório na abertura do atendimento APS (param REQUIRE_INE_APS_OPEN). Informe assignmentId/equipe com INE.',
      );
    }
    if (!facility.ibgeCode && !apsMunicipioIbgeFallback()) {
      throw new BadRequestException('Unidade sem IBGE e sem MUNICIPIO_IBGE configurado.');
    }

    const care = defaultApsCareDraft({
      assignmentId,
      cbo: dto.cbo || lotacao.cboCodigo_2002,
    });

    const row = await this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId,
        teamId,
        appointmentId: dto.appointmentId,
        careLocation: dto.careLocation || 'UBS',
        shift: dto.shift || 'TARDE',
        encounterType: dto.encounterType || 'CONSULTA_NO_DIA',
        lateRegistration: dto.lateRegistration ?? false,
        status: 'IN_PROGRESS',
        clinicalJson: JSON.stringify(care),
      },
      include: { patient: true, facility: true, professional: true },
    });

    if (dto.appointmentId) {
      await this.prisma.appointmentSlot.update({
        where: { id: dto.appointmentId },
        data: { status: 'PRESENT' },
      });
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'individual_encounter',
        status: 'draft',
        rfIdsCsv: [RF.ENCOUNTER_CLINICAL.id, RF.ESUS.id, RF.PROD.id].join(','),
        payloadJson: JSON.stringify({
          encounterId: row.id,
          facilityId: row.facilityId,
          patientId: row.patientId,
          competencia: competenciaFromDate(row.startedAt),
          queue: true,
          fichaTipo: 4,
        }),
        statusChangedAt: new Date(),
        errorMessage: 'Atendimento APS aberto — pendente validação/preenchimento FAI',
      },
    });
    const withBatch = await this.prisma.encounter.update({
      where: { id: row.id },
      data: { productionBatchId: batch.id },
      include: { patient: true, facility: true, professional: true },
    });

    await this.prisma.audit('open_fai', 'encounter', row.id, [RF.ENCOUNTER_ENTRY.id, RF.ESUS.id], {
      requireIne: requireIneOnApsOpen(),
      tipoAtendimento: care.tipoAtendimento,
      productionBatchId: batch.id,
      assignmentId,
    });
    return { ...this.serialize(withBatch), reused: false as const };
  }

  async get(id: string) {
    const row = await this.prisma.encounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true, appointment: true },
    });
    if (!row) throw new NotFoundException('Atendimento não encontrado');
    return this.serialize(row);
  }

  async updateStatus(id: string, dto: UpdateEncounterStatusDto) {
    const row = await this.prisma.encounter.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Atendimento não encontrado');
    if (!ENCOUNTER_STATUS.includes(dto.status as EncounterStatus)) {
      throw new BadRequestException('status inválido');
    }
    if (row.status === 'COMPLETED') {
      throw new BadRequestException('Atendimento já finalizado');
    }
    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { status: dto.status, statusChangedAt: new Date() },
    });
    await this.prisma.audit('status', 'encounter', id, [RF.ENCOUNTER_ENTRY.id], {
      from: row.status,
      to: dto.status,
    });
    return updated;
  }

  async saveClinical(id: string, dto: SaveClinicalDto) {
    const row = await this.prisma.encounter.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Atendimento não encontrado');
    if (row.status === 'COMPLETED') {
      throw new BadRequestException('Atendimento já finalizado');
    }

    const current = this.parseClinical(row.clinicalJson);
    const care = parseApsCare(row.clinicalJson);
    const nextCare: ApsCareDraft = {
      ...care,
      ...(dto.tipoAtendimento != null ? { tipoAtendimento: dto.tipoAtendimento } : {}),
      ...(dto.localAtendimento != null ? { localAtendimento: dto.localAtendimento } : {}),
      ...(dto.turno != null ? { turno: dto.turno } : {}),
      ...(dto.assignmentId !== undefined ? { assignmentId: dto.assignmentId } : {}),
      ...(dto.cbo !== undefined ? { cbo: dto.cbo } : {}),
      ...(dto.stNaoPossuiCpf != null ? { stNaoPossuiCpf: dto.stNaoPossuiCpf } : {}),
      ...(dto.justificativaNaoPossuiCpf !== undefined
        ? { justificativaNaoPossuiCpf: dto.justificativaNaoPossuiCpf }
        : {}),
      ...(dto.gestante != null ? { gestante: dto.gestante } : {}),
      ...(dto.problemasCondicoes ? { problemasCondicoes: dto.problemasCondicoes } : {}),
      ...(dto.procedimentos ? { procedimentos: dto.procedimentos } : {}),
      ...(dto.outcomes ? { outcomes: dto.outcomes } : {}),
      soapSubjective: dto.soapSubjective ?? care.soapSubjective ?? current.soapSubjective,
      soapObjective: dto.soapObjective ?? care.soapObjective ?? current.soapObjective,
      soapAssessment: dto.soapAssessment ?? care.soapAssessment ?? current.soapAssessment,
      soapPlan: dto.soapPlan ?? care.soapPlan ?? current.soapPlan,
      ciapCodes: dto.ciapCodes ?? care.ciapCodes ?? current.ciapCodes,
      cidCodes: dto.cidCodes ?? care.cidCodes ?? current.cidCodes,
      weightKg: dto.weightKg ?? care.weightKg ?? current.weightKg,
      heightCm: dto.heightCm ?? care.heightCm ?? current.heightCm,
      headCircumferenceCm:
        dto.headCircumferenceCm ?? care.headCircumferenceCm ?? current.headCircumferenceCm,
    };

    const next: ClinicalData = {
      ...current,
      ...nextCare,
      soapSubjective: nextCare.soapSubjective,
      soapObjective: nextCare.soapObjective,
      soapAssessment: nextCare.soapAssessment,
      soapPlan: nextCare.soapPlan,
      ciapCodes: nextCare.ciapCodes,
      cidCodes: nextCare.cidCodes,
      procedures: dto.procedures ?? current.procedures,
      outcomes: nextCare.outcomes,
      weightKg: nextCare.weightKg,
      heightCm: nextCare.heightCm,
      headCircumferenceCm: nextCare.headCircumferenceCm,
    };

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        clinicalJson: JSON.stringify(next),
        careLocation: dto.careLocation ?? row.careLocation,
        shift: dto.shift ?? row.shift,
        encounterType: dto.encounterType ?? row.encounterType,
        professionalId: row.professionalId,
        status: row.status === 'WAITING' ? 'IN_PROGRESS' : row.status,
        statusChangedAt: new Date(),
      },
      include: { patient: true, facility: true, professional: true },
    });
    await this.prisma.audit('clinical', 'encounter', id, [RF.ENCOUNTER_CLINICAL.id]);
    if (isFaiOrigin(updated.clinicalJson) && updated.productionBatchId) {
      await this.syncApsBillingQueue(id).catch(() => undefined);
    }
    return this.serialize(updated);
  }

  async previewFai(id: string) {
    const built = await this.buildFaiPayload(id, {});
    const fai = validateFaiJson(built.payload as unknown as Record<string, unknown>);
    return {
      encounterId: id,
      lotacao: built.lotacao,
      fai,
      siapsReady: fai.siapsReady,
      canFinish: fai.summary.blockers === 0,
      payload: built.payload,
    };
  }

  private async syncApsBillingQueue(id: string) {
    try {
      const built = await this.buildFaiPayload(id, {});
      const fai = validateFaiJson(built.payload as unknown as Record<string, unknown>);
      if (!built.row.productionBatchId) return;
      const blockers = fai.summary.blockers;
      await this.prisma.productionBatch.update({
        where: { id: built.row.productionBatchId },
        data: {
          status: blockers > 0 ? 'error' : 'draft',
          errorMessage:
            blockers > 0
              ? fai.findings
                  .filter((f) => f.severity === 'BLOCKER')
                  .map((f) => f.code)
                  .slice(0, 10)
                  .join(', ')
              : 'Rascunho FAI — aguardando fechamento',
          payloadJson: JSON.stringify({
            ...built.payload,
            encounterId: id,
            competencia: competenciaFromDate(built.row.startedAt),
            queue: true,
            fichaTipo: 4,
            faiValidation: fai,
          }),
          statusChangedAt: new Date(),
        },
      });
    } catch (e) {
      const row = await this.prisma.encounter.findUnique({ where: { id } });
      if (!row?.productionBatchId) return;
      await this.prisma.productionBatch.update({
        where: { id: row.productionBatchId },
        data: {
          status: 'error',
          errorMessage: e instanceof Error ? e.message : String(e),
          statusChangedAt: new Date(),
        },
      });
    }
  }

  private async buildFaiPayload(id: string, dto: Partial<FinishEncounterDto> = {}) {
    const row = await this.prisma.encounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atendimento não encontrado');
    const care = parseApsCare(row.clinicalJson);
    const outcomes = dto.outcomes?.length ? dto.outcomes : care.outcomes;
    if (!outcomes?.length) throw new BadRequestException('outcomes (condutas) obrigatórias');

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
      assignmentId: dto.assignmentId || care.assignmentId || undefined,
      cbo: dto.cbo || care.cbo || undefined,
    });
    if (requireIneOnApsOpen() && !lotacao.ine) {
      throw new BadRequestException('INE obrigatório para faturar FAI (param REQUIRE_INE_APS_OPEN).');
    }

    const clinical: ClinicalData = {
      ...care,
      outcomes,
    };
    const finishedAt = dto.finishedAt ? new Date(dto.finishedAt) : new Date();
    const uuidFicha = randomUUID();
    let payload;
    try {
      payload = buildIndividualEncounterLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: row.facility.ibgeCode || apsMunicipioIbgeFallback(),
        startedAt: row.startedAt,
        finishedAt,
        patient: row.patient,
        careLocation: row.careLocation,
        shift: row.shift,
        encounterType: row.encounterType,
        tipoAtendimento: care.tipoAtendimento,
        localAtendimento: care.localAtendimento,
        turno: care.turno,
        clinical,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return { row, care, lotacao, payload, outcomes, finishedAt, uuidFicha };
  }

  async finish(id: string, dto: FinishEncounterDto) {
    const row = await this.prisma.encounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atendimento não encontrado');
    if (row.status === 'COMPLETED') {
      throw new BadRequestException('Atendimento já finalizado');
    }
    if (!dto.outcomes?.length) {
      throw new BadRequestException('outcomes (condutas) obrigatórias para finalizar');
    }

    if (isFaiOrigin(row.clinicalJson)) {
      return this.finishFai(id, dto);
    }

    const clinical = {
      ...this.parseClinical(row.clinicalJson),
      outcomes: dto.outcomes,
    };
    const finishedAt = dto.finishedAt ? new Date(dto.finishedAt) : new Date();
    const uuidFicha = randomUUID();

    let teamIne: string | null = null;
    if (row.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: row.teamId } });
      teamIne = team?.ine ?? null;
    }

    const assignments = row.professionalId
      ? await this.prisma.professionalAssignment.findMany({
          where: {
            professionalId: row.professionalId,
            facilityId: row.facilityId,
            active: true,
          },
          include: { professional: true, facility: true, team: true },
        })
      : [];

    let lotacao;
    try {
      lotacao = resolveLotacaoHeader({
        facilityCnes: row.facility.cnes,
        professionalCns: row.professional?.cns,
        teamIne,
        cboOverride: dto.cbo,
        assignmentId: dto.assignmentId,
        assignments,
        professionalId: row.professionalId,
        facilityId: row.facilityId,
        teamId: row.teamId,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    let payload;
    try {
      payload = buildIndividualEncounterLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: row.facility.ibgeCode,
        startedAt: row.startedAt,
        finishedAt,
        patient: row.patient,
        careLocation: row.careLocation,
        shift: row.shift,
        encounterType: row.encounterType,
        clinical,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'individual_encounter',
        status: 'ready',
        rfIdsCsv: [RF.ENCOUNTER_CLINICAL.id, RF.ESUS.id, RF.PROD.id].join(','),
        payloadJson: JSON.stringify(payload),
      },
    });

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        finishedAt,
        statusChangedAt: finishedAt,
        clinicalJson: JSON.stringify(clinical),
        productionBatchId: batch.id,
      },
    });

    if (row.appointmentId) {
      await this.prisma.appointmentSlot.update({
        where: { id: row.appointmentId },
        data: { status: 'COMPLETED' },
      });
    }

    await this.prisma.audit('finish', 'encounter', id, [RF.ENCOUNTER_CLINICAL.id, RF.PROD.id], {
      productionBatchId: batch.id,
      uuidFicha,
    });

    return {
      encounter: { ...updated, clinical },
      productionBatch: {
        id: batch.id,
        kind: batch.kind,
        status: batch.status,
        payload,
      },
    };
  }

  private async finishFai(id: string, dto: FinishEncounterDto) {
    const built = await this.buildFaiPayload(id, dto);
    const fai = validateFaiJson(built.payload as unknown as Record<string, unknown>);
    if (dto.enforceFaiConformity !== false && fai.summary.blockers > 0) {
      throw new BadRequestException({
        message: 'Ficha individual não conforme para envio Siaps (LEDI FAI tipo 4).',
        fai,
      });
    }

    const batchPayload = JSON.stringify({
      ...built.payload,
      encounterId: id,
      competencia: competenciaFromDate(built.row.startedAt),
      queue: true,
      fichaTipo: 4,
      faiValidation: fai,
    });
    const batchStatus = fai.summary.blockers > 0 ? 'error' : 'ready';
    const errorMessage =
      fai.summary.blockers > 0
        ? fai.findings
            .filter((x) => x.severity === 'BLOCKER')
            .map((x) => x.code)
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
          kind: 'individual_encounter',
          status: batchStatus,
          errorMessage,
          statusChangedAt: new Date(),
          rfIdsCsv: [RF.ENCOUNTER_CLINICAL.id, RF.ESUS.id, RF.PROD.id].join(','),
          payloadJson: batchPayload,
        },
      });
    }

    const clinical = { ...built.care, outcomes: built.outcomes };
    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        finishedAt: built.finishedAt,
        statusChangedAt: built.finishedAt,
        clinicalJson: JSON.stringify(clinical),
        productionBatchId: batch.id,
      },
      include: { patient: true, facility: true, professional: true },
    });

    if (updated.appointmentId) {
      await this.prisma.appointmentSlot.update({
        where: { id: updated.appointmentId },
        data: { status: 'COMPLETED' },
      });
    }

    await this.prisma.audit('finish_fai', 'encounter', id, [RF.ENCOUNTER_CLINICAL.id, RF.PROD.id], {
      productionBatchId: batch.id,
      uuidFicha: built.uuidFicha,
      siapsReady: fai.siapsReady,
    });

    return {
      encounter: this.serialize(updated),
      productionBatch: {
        id: batch.id,
        kind: batch.kind,
        status: batch.status,
        payload: built.payload,
      },
      fai,
    };
  }
}

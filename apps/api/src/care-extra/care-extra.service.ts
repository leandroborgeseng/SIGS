import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { resolveLotacaoHeader } from '../ledi/lotacao.resolver';
import {
  CreateDentalEncounterDto,
  CreateHomeCareVisitDto,
  CreateCollectiveActivityDto,
  FinishDentalEncounterDto,
  FinishHomeCareVisitDto,
  FinishCollectiveActivityDto,
  ValidateDentalFaoDto,
} from './dto';
import { buildDentalLediPayload } from './ledi-dental.mapper';
import { buildHomeCareLediPayload } from './ledi-homecare.mapper';
import { buildCollectiveLediPayload } from './ledi-collective.mapper';
import { validateFaoJson, validateFaoXml } from './ledi-fao.validator';

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
      tipoAtendimento: [
        { id: 2, label: 'Consulta agendada' },
        { id: 4, label: 'Escuta inicial / orientação' },
        { id: 5, label: 'Consulta no dia' },
        { id: 6, label: 'Atendimento de urgência' },
      ],
      vigilanciaSaudeBucal: [
        { id: 1, label: 'Abscesso dentoalveolar' },
        { id: 2, label: 'Alteração em tecidos moles' },
        { id: 3, label: 'Dor de dente' },
        { id: 4, label: 'Traumatismo dentoalveolar' },
        { id: 5, label: 'Não identificado / sem marcador' },
        { id: 6, label: 'Fluorose' },
        { id: 7, label: 'Outro' },
      ],
      condutas: [
        { id: 'ALTA', label: 'Alta do episódio', lediId: 17 },
        { id: 'TRATAMENTO_CONCLUIDO', label: 'Tratamento concluído', lediId: 15 },
        { id: 'RETORNO', label: 'Retorno para consulta agendada', lediId: 16 },
      ],
      fornecimentos: [
        { id: 'ESCOVA', label: 'Escova dental', lediId: 1 },
        { id: 'CREME', label: 'Creme dental', lediId: 2 },
        { id: 'FIO', label: 'Fio dental', lediId: 3 },
      ],
      channelNote:
        'Conformidade de envio odonto APS/CEO→Siaps/RNDS: LEDI FAO (XML|Thrift), não Bundle FHIR RIA neste fluxo (Portaria GM/MS 10.192/2026).',
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

  async getDental(id: string) {
    const row = await this.prisma.dentalEncounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atendimento odontológico não encontrado');
    return {
      ...row,
      procedures: JSON.parse(row.proceduresJson || '[]'),
      odontogram: JSON.parse(row.odontogramJson || '{}'),
      outcomes: JSON.parse(row.outcomesJson || '[]'),
    };
  }

  async openDental(dto: CreateDentalEncounterDto) {
    if (!(await this.prisma.patient.findUnique({ where: { id: dto.patientId } }))) {
      throw new BadRequestException('patientId inválido');
    }
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');

    const row = await this.prisma.dentalEncounter.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        encounterType: dto.encounterType || 'CONSULTA',
        anamnese: dto.anamnese,
        proceduresJson: JSON.stringify(dto.procedures || []),
        odontogramJson: JSON.stringify(dto.odontogram || {}),
        status: 'IN_PROGRESS',
      },
      include: { patient: true, facility: true },
    });
    await this.prisma.audit('open', 'dental_encounter', row.id, [RF.ODONTO.id]);
    return row;
  }

  async finishDental(id: string, dto: FinishDentalEncounterDto) {
    const row = await this.prisma.dentalEncounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Atendimento odontológico não encontrado');
    if (row.status === 'COMPLETED') throw new BadRequestException('Já finalizado');
    if (!dto.outcomes?.length) throw new BadRequestException('outcomes obrigatórias');

    const lotacao = await this.resolveLotacao({
      professionalId: row.professionalId,
      facilityId: row.facilityId,
      facilityCnes: row.facility.cnes,
      professionalCns: row.professional?.cns,
      assignmentId: dto.assignmentId,
      cbo: dto.cbo,
    });

    const finishedAt = dto.finishedAt ? new Date(dto.finishedAt) : new Date();
    const uuidFicha = randomUUID();
    let payload;
    try {
      payload = buildDentalLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: row.facility.ibgeCode,
        startedAt: row.startedAt,
        finishedAt,
        patient: row.patient,
        careLocation: dto.careLocation || 'UBS',
        shift: dto.shift || 'MANHA',
        encounterType: row.encounterType,
        tipoAtendimento: dto.tipoAtendimento,
        outcomes: dto.outcomes,
        vigilanciaSaudeBucal: dto.vigilanciaSaudeBucal,
        fornecimentos: dto.fornecimentos,
        problemasCondicoes: dto.problemasCondicoes,
        gestante: dto.gestante,
        necessidadesEspeciais: dto.necessidadesEspeciais,
        stNaoPossuiCpf: dto.stNaoPossuiCpf,
        justificativaNaoPossuiCpf: dto.justificativaNaoPossuiCpf,
        procedures: JSON.parse(row.proceduresJson || '[]'),
        odontogram: JSON.parse(row.odontogramJson || '{}'),
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const faoReport = validateFaoJson(payload as unknown as Record<string, unknown>);
    if (dto.enforceFaoConformity !== false && faoReport.summary.blockers > 0) {
      throw new BadRequestException({
        message: 'Ficha odontológica não conforme para envio Siaps/RNDS (LEDI FAO).',
        fao: faoReport,
      });
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'dental_encounter',
        status: faoReport.summary.blockers > 0 ? 'error' : 'ready',
        errorMessage:
          faoReport.summary.blockers > 0
            ? faoReport.findings
                .filter((f) => f.severity === 'BLOCKER')
                .map((f) => f.code)
                .slice(0, 8)
                .join(', ')
            : null,
        statusChangedAt: new Date(),
        rfIdsCsv: [RF.ODONTO.id, RF.PROD.id, RF.BPA.id, RF.ESUS.id].join(','),
        payloadJson: JSON.stringify({ ...payload, faoValidation: faoReport }),
      },
    });

    const updated = await this.prisma.dentalEncounter.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        finishedAt,
        outcomesJson: JSON.stringify(dto.outcomes),
        productionBatchId: batch.id,
      },
      include: { patient: true, facility: true },
    });
    await this.prisma.audit('finish', 'dental_encounter', id, [RF.ODONTO.id, RF.PROD.id], {
      productionBatchId: batch.id,
      faoConformant: faoReport.conformant,
    });
    return { encounter: updated, productionBatch: { ...batch, payload }, fao: faoReport };
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

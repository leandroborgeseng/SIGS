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

    const existing = await this.prisma.encounter.findFirst({
      where: {
        patientId: dto.patientId,
        startedAt: { gte: this.startOfToday() },
        status: { in: [...ENCOUNTER_ACTIVE_QUEUE] },
      },
      include: { patient: true, facility: true, professional: true },
    });
    if (existing) {
      // Continuar da fila do dia em vez de 409 — UX piloto UBS
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

  async get(id: string) {
    const row = await this.prisma.encounter.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true, appointment: true },
    });
    if (!row) throw new NotFoundException('Atendimento não encontrado');
    return { ...row, clinical: this.parseClinical(row.clinicalJson) };
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
    const next: ClinicalData = {
      ...current,
      soapSubjective: dto.soapSubjective ?? current.soapSubjective,
      soapObjective: dto.soapObjective ?? current.soapObjective,
      soapAssessment: dto.soapAssessment ?? current.soapAssessment,
      soapPlan: dto.soapPlan ?? current.soapPlan,
      ciapCodes: dto.ciapCodes ?? current.ciapCodes,
      cidCodes: dto.cidCodes ?? current.cidCodes,
      procedures: dto.procedures ?? current.procedures,
      outcomes: dto.outcomes ?? current.outcomes,
      weightKg: dto.weightKg ?? current.weightKg,
      heightCm: dto.heightCm ?? current.heightCm,
      headCircumferenceCm: dto.headCircumferenceCm ?? current.headCircumferenceCm,
    };

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        clinicalJson: JSON.stringify(next),
        careLocation: dto.careLocation ?? row.careLocation,
        shift: dto.shift ?? row.shift,
        encounterType: dto.encounterType ?? row.encounterType,
        status: row.status === 'WAITING' ? 'IN_PROGRESS' : row.status,
        statusChangedAt: new Date(),
        professionalId: row.professionalId,
      },
    });
    await this.prisma.audit('clinical', 'encounter', id, [RF.ENCOUNTER_CLINICAL.id]);
    return { ...updated, clinical: next };
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
}

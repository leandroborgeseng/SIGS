import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import {
  DOSES,
  IMMUNOBIOLOGICALS,
  ROUTES,
  SITES,
  STRATEGIES,
  VaccineApplicationInput,
  validateVaccineApplications,
} from './catalog';
import { CreateVaccinationDto } from './dto';
import { buildVaccinationLediPayload } from './ledi-vaccination.mapper';
import { resolveLotacaoHeader } from '../ledi/lotacao.resolver';

@Injectable()
export class VaccinationsService {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return {
      immunobiologicals: IMMUNOBIOLOGICALS,
      strategies: STRATEGIES,
      doses: DOSES,
      routes: ROUTES,
      sites: SITES,
      attendanceGroups: [
        { id: 'GERAL', label: 'Geral' },
        { id: 'GESTANTE', label: 'Gestante' },
        { id: 'PUERPERA', label: 'Puérpera' },
      ],
    };
  }

  private parseApps(json: string): VaccineApplicationInput[] {
    return JSON.parse(json || '[]') as VaccineApplicationInput[];
  }

  list(patientId?: string, facilityId?: string) {
    return this.prisma.vaccinationRecord.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(facilityId ? { facilityId } : {}),
      },
      orderBy: { appliedAt: 'desc' },
      include: { patient: true, facility: true, professional: true },
    });
  }

  async get(id: string) {
    const row = await this.prisma.vaccinationRecord.findUnique({
      where: { id },
      include: { patient: true, facility: true, professional: true },
    });
    if (!row) throw new NotFoundException('Registro de vacinação não encontrado');
    return { ...row, applications: this.parseApps(row.applicationsJson) };
  }

  async card(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    const records = await this.prisma.vaccinationRecord.findMany({
      where: { patientId, status: { in: ['READY', 'SENT', 'DRAFT'] } },
      orderBy: { appliedAt: 'desc' },
    });
    const doses = records.flatMap((r) => {
      const apps = this.parseApps(r.applicationsJson);
      return apps.map((a) => ({
        date: r.appliedAt.toISOString().slice(0, 10),
        immunobiological: a.immunobiologicalId,
        dose: a.doseId,
        lot: a.lot,
        strategy: a.strategyId,
        recordId: r.id,
        status: r.status,
      }));
    });
    return {
      patientId,
      patientName: patient.socialName || patient.civilName,
      doses,
    };
  }

  async create(dto: CreateVaccinationDto) {
    const errors = validateVaccineApplications(dto.applications);
    if (errors.length) throw new BadRequestException({ errors });

    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new BadRequestException('patientId inválido');
    const facility = await this.prisma.facility.findUnique({ where: { id: dto.facilityId } });
    if (!facility) throw new BadRequestException('facilityId inválido');
    if (dto.professionalId) {
      const prof = await this.prisma.professional.findUnique({ where: { id: dto.professionalId } });
      if (!prof) throw new BadRequestException('professionalId inválido');
    }

    const appliedAt = dto.appliedAt ? new Date(dto.appliedAt) : new Date();
    if (patient.birthDate > appliedAt) {
      throw new BadRequestException('data de nascimento não pode ser após a aplicação');
    }

    const uuidFicha = randomUUID();
    let teamIne: string | null = null;
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
      teamIne = team?.ine ?? null;
    }

    const professional = dto.professionalId
      ? await this.prisma.professional.findUnique({ where: { id: dto.professionalId } })
      : null;

    const assignments = dto.professionalId
      ? await this.prisma.professionalAssignment.findMany({
          where: {
            professionalId: dto.professionalId,
            facilityId: dto.facilityId,
            active: true,
          },
          include: { professional: true, facility: true, team: true },
        })
      : [];

    let lotacao;
    try {
      lotacao = resolveLotacaoHeader({
        facilityCnes: facility.cnes,
        professionalCns: professional?.cns,
        teamIne,
        cboOverride: dto.cbo,
        assignmentId: dto.assignmentId,
        assignments,
        professionalId: dto.professionalId,
        facilityId: dto.facilityId,
        teamId: dto.teamId,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    let payload;
    try {
      payload = buildVaccinationLediPayload({
        uuidFicha,
        lotacao,
        codigoIbgeMunicipio: facility.ibgeCode,
        appliedAt,
        shift: dto.shift,
        careLocation: dto.careLocation,
        patient,
        applications: dto.applications,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const batch = await this.prisma.productionBatch.create({
      data: {
        kind: 'vaccination',
        status: 'ready',
        rfIdsCsv: [RF.VACCINATION.id, RF.ESUS.id, RF.PROD.id].join(','),
        payloadJson: JSON.stringify(payload),
      },
    });

    const row = await this.prisma.vaccinationRecord.create({
      data: {
        patientId: dto.patientId,
        facilityId: dto.facilityId,
        professionalId: dto.professionalId,
        shift: dto.shift,
        careLocation: dto.careLocation,
        appliedAt,
        status: 'READY',
        applicationsJson: JSON.stringify(dto.applications),
        productionBatchId: batch.id,
      },
    });

    await this.prisma.audit('create', 'vaccination', row.id, [RF.VACCINATION.id, RF.PROD.id], {
      productionBatchId: batch.id,
      uuidFicha,
    });

    return {
      record: { ...row, applications: dto.applications },
      productionBatch: { id: batch.id, kind: batch.kind, status: batch.status, payload },
    };
  }
}
